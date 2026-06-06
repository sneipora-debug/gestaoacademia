// =========================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO DO SUPABASE
// =========================================================================
const SUPABASE_URL = "https://ltuepchgoxagpquwalbi.supabase.co"; // [cite: 902]
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dWVwY2hnb3hhZ3BxdXdhbGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDczMjYsImV4cCI6MjA5NjE4MzMyNn0.g7742A-X_TM-YOZDB40e2aweKfxAfr4xbF29_NlsC2Q"; // [cite: 903, 904]

// Inicializa o cliente global uma única vez no topo do arquivo
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null; // [cite: 906, 907, 908]

if (!supabaseClient) {
  // [cite: 909]
  console.error(
    "Erro: A biblioteca do Supabase não foi carregada no HTML ou as chaves estão incorretas."
  ); // [cite: 910, 911, 912]
}

// =========================================================================
// INICIALIZAÇÃO DO SISTEMA E VARIÁVEIS DE ESCOPO
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // [cite: 917]
  // Elementos comuns do DOM
  const form = document.getElementById("formAluno"); // [cite: 919]
  const tabelaAlunos = document.getElementById("tabelaAlunos"); // [cite: 920]
  const pesoInput = document.getElementById("peso"); // [cite: 921]
  const alturaInput = document.getElementById("altura"); // [cite: 922]
  const imcInput = document.getElementById("imc"); // [cite: 923]
  let editId = null; // Controla se o formulário está editando um aluno // [cite: 924]

  // Função para gerar matrícula automática (Ex: 2024 + 4 números aleatórios)
  const gerarMatriculaAutomatica = () => {
    const matriculaInput = document.getElementById("matricula");
    if (matriculaInput && !editId) {
      const ano = new Date().getFullYear();
      const random = Math.floor(1000 + Math.random() * 9000); // Gera entre 1000 e 9999
      matriculaInput.value = `${ano}${random}`;
    }
  };

  // Variáveis para filtros financeiros extraídas do escopo
  const urlParams = new URLSearchParams(window.location.search); // [cite: 1020]
  let filtroStatus = urlParams.get("filtro"); // [cite: 1021]
  const buscaUrl = urlParams.get("busca");
  if (buscaUrl && document.getElementById("buscaNome")) {
    document.getElementById("buscaNome").value = buscaUrl;
  }

  const filtroPagamento = urlParams.get("pagamento");
  // Variáveis de filtro (serão atualizadas dinamicamente)
  let mesFiltro = (new Date().getMonth() + 1).toString().padStart(2, "0");
  let anoFiltro = new Date().getFullYear();
  let refFiltro = `${mesFiltro}/${anoFiltro}`;

  const atualizarVariaveisFiltro = () => {
    mesFiltro = document.getElementById("filtroMes")?.value || (new Date().getMonth() + 1).toString().padStart(2, "0");
    anoFiltro = document.getElementById("filtroAno")?.value || new Date().getFullYear();
    refFiltro = `${mesFiltro}/${anoFiltro}`;
  };

  // Inicializa os campos de filtro no HTML com a data atual (evita o erro de Janeiro/01)
  const inputFiltroMes = document.getElementById("filtroMes");
  const inputFiltroAno = document.getElementById("filtroAno");
  if (inputFiltroMes && !urlParams.get("mes")) {
    inputFiltroMes.value = mesFiltro;
  }
  if (inputFiltroAno && !urlParams.get("ano")) {
    inputFiltroAno.value = anoFiltro;
  }
  atualizarVariaveisFiltro();

  // Funções Auxiliares locais
  const normalizarTexto = (
    txt // [cite: 926]
  ) =>
    String(txt) // [cite: 927]
      .toLowerCase() // [cite: 928]
      .trim() // [cite: 929]
      .normalize("NFD") // [cite: 930]
      .replace(/[\u0300-\u036f]/g, ""); // [cite: 931]

  const limparMoeda = (
    valor // [cite: 932]
  ) =>
    parseFloat(
      // [cite: 933]
      String(valor) // [cite: 934]
        .replace(/[R$\s.]/g, "") // [cite: 935]
        .replace(",", ".") // [cite: 936]
    ) || 0; // [cite: 937]

  const formatarMoeda = (
    valor // [cite: 938]
  ) =>
    Number(valor).toLocaleString("pt-BR", {
      // [cite: 939]
      style: "currency", // [cite: 940]
      currency: "BRL", // [cite: 941]
    });

  window.mostrarToast = (msg, tipo = "success") => { // Made global
    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000); // Remove após 3 segundos
  };
  const mostrarToast = window.mostrarToast; // Keep local reference for existing calls

  const atualizarDashboard = () => console.log("Dashboard atualizado."); // [cite: 945]
  
  window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.innerText.includes(tabId.replace('tab', '')));
    if(btn) btn.classList.add('active');
  };

  window.exibirExtratoAluno = async (id) => {
    if (!supabaseClient) return;

    // Se estiver no financeiro, esconde a mensagem inicial e mostra os detalhes
    if (document.getElementById('detalheAluno')) {
        document.getElementById('detalheAluno').style.display = 'block';
        document.getElementById('msgSelecione').style.display = 'none';
    }
    
    // Busca dados do aluno para a Ficha Funcional
    const { data: aluno, error: errAluno } = await supabaseClient
      .from("alunos")
      .select("*")
      .eq("id", id)
      .single();

    if (errAluno) return mostrarToast("Erro ao carregar dados do aluno.", "error");

    // Busca simultaneamente pagamentos (PAGOS) e cobranças (PENDENTES/ATRASADOS)
    const [reqPagamentos, reqCobrancas] = await Promise.all([
      supabaseClient
      .from("pagamentos")
      .select("*")
      .eq("aluno_id", id)
      .order("created_at", { ascending: false }),
      supabaseClient
      .from("cobrancas")
      .select("*")
      .eq("aluno_id", id)
      .order("vencimento", { ascending: false })
    ]);

    if (reqPagamentos.error || reqCobrancas.error) {
      return mostrarToast("Erro ao carregar histórico completo.", "error");
    }

    const pagamentos = reqPagamentos.data || [];
    const cobrancas = reqCobrancas.data || [];

    const modal = document.getElementById("modalExtrato"); // [cite: 111]
    let tabelaCorpo = document.getElementById("extratoTabelaCorpo"); 
    const extratoNome = document.getElementById("extratoNomeAluno");
    
    if (tabelaCorpo) {
      tabelaCorpo.innerHTML = "";
      let totalPago = 0;
      let totalAtrasado = 0;

      let tempoDeCasa = "0 dias";
      let dataInicioFormatada = "--/--/----";
      if (aluno && aluno.created_at) {
          const inicio = new Date(aluno.created_at);
          dataInicioFormatada = inicio.toLocaleDateString('pt-BR');
          const hoje = new Date();
          const diffMs = hoje - inicio;
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays >= 30) {
              tempoDeCasa = `${Math.floor(diffDays / 30)} mês(es)`;
          } else {
              tempoDeCasa = `${diffDays} dia(s)`;
          }
      }

      // Unifica os dados para exibição em uma única linha do tempo
      const historicoUnificado = [
        ...pagamentos.map(p => ({
          id: p.id,
          referencia: p.referencia,
          vencimento: p.data,
          valor: p.valor,
          status: 'PAGO',
          metodo: p.metodo || 'PIX',
          sortDate: new Date(p.data)
        })),
        ...cobrancas.map(c => ({
          id: c.id,
          referencia: c.competencia,
          vencimento: c.vencimento,
          valor: c.valor,
          status: c.status,
          metodo: '---',
          sortDate: new Date(c.vencimento)
        }))
      ];

      // Ordena por data (mais recente primeiro)
      historicoUnificado.sort((a, b) => b.sortDate - a.sortDate);

      historicoUnificado.forEach(p => {
        if (p.status === 'PAGO') totalPago += parseFloat(p.valor);
        if (p.status === 'ATRASADO') totalAtrasado += parseFloat(p.valor);
        
        const hoje = new Date().toISOString().split('T')[0];
        const badgeClass = p.status === 'PAGO' ? 'pago' : (p.status === 'ATRASADO' ? 'atrasado' : 'pendente');
        
          const actions = p.status === 'PAGO' 
            ? `<button onclick="imprimirRecibo('${id}', '${p.referencia}')" class="badge-pagamento pago">📄</button>`
            : `<div style="display:flex; gap:5px; align-items:center;">
                <input type="date" id="data_cob_${p.id}" value="${hoje}" style="width:110px; padding:2px; font-size:11px; background:#0f172a; border:1px solid var(--border); color:white; border-radius:4px;">
                <button onclick="confirmarPagamentoCobranca('${p.id}')" class="badge-pagamento pendente" style="min-width:unset;" title="Confirmar Recebimento">✅</button>
                <button onclick="window.gerarPix('${id}', '${p.valor}')" class="badge-pagamento pendente" style="min-width:unset; background:#7c3aed;" title="Ver QR Code">🖼️</button>
                <button onclick="window.copiarPixCobranca('${id}', '${p.valor}')" class="badge-pagamento pendente" style="min-width:unset; background:#3b82f6;" title="Copiar Código PIX">📋</button>
                <button onclick="window.enviarWhatsAppCobranca('${id}', '${p.valor}', '${p.referencia}')" class="badge-pagamento pago" style="min-width:unset; background:#22c55e;" title="Enviar para WhatsApp">📱</button>
               </div>`;

        const row = tabelaCorpo.insertRow();
        row.innerHTML = `
          <td>${p.referencia}</td>
          <td>${new Date(p.vencimento).toLocaleDateString('pt-BR')}</td>
          <td>${formatarMoeda(p.valor)}</td>
          <td><span class="badge-pagamento ${badgeClass}">${p.status}</span></td>
          <td>${actions}</td>
        `;
      });

      // PREENCHIMENTO AUTOMÁTICO DO FORMULÁRIO DE CADASTRO (CASO EXISTA NA PÁGINA)
      const mapeamentoCampos = {
        "nome": aluno.nome,
        "matricula": aluno.matricula,
        "cpf": aluno.cpf,
        "rg": aluno.rg,
        "responsavel": aluno.responsavel,
        "nascimento": aluno.nascimento,
        "sexo": aluno.sexo,
        "estadoCivil": aluno.estado_civil,
        "celular": aluno.celular,
        "whatsapp": aluno.whatsapp,
        "email": aluno.email,
        "vencimento": aluno.vencimento,
        "peso": aluno.peso,
        "altura": aluno.altura,
        "imc": aluno.imc
      };

      Object.keys(mapeamentoCampos).forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = mapeamentoCampos[id] || "";
      });
      if(document.getElementById("status")) document.getElementById("status").checked = aluno.status === true;
      editId = id; // Ativa modo edição

      // Atualiza Perfil (se estiver na página Financeiro)
      if (document.getElementById('profileNome')) {
          document.getElementById('profileNome').innerText = aluno.nome;
          document.getElementById('profilePlanoMatricula').innerText = `Plano: ${aluno.plano} | Matrícula: ${aluno.matricula || '---'}`;
          const statusBadge = document.getElementById('profileStatus');
          statusBadge.innerText = aluno.status ? 'Ativo' : 'Inativo'; // [cite: 198]
          statusBadge.className = `status-badge ${aluno.status ? 'pago' : 'atrasado'}`;
          document.getElementById('profileIcon').innerText = aluno.nome.charAt(0).toUpperCase();
      }

      if (extratoNome) extratoNome.innerText = `Histórico Financeiro: ${aluno.nome}`;
      
      const extratoPagoElem = document.getElementById("extratoPago");
      const extratoAtrasadoElem = document.getElementById("extratoAtrasado");
      const extratoInicioElem = document.getElementById("extratoInicio");
      const extratoTempoElem = document.getElementById("extratoTempo");
      
      if (extratoPagoElem) extratoPagoElem.innerText = formatarMoeda(totalPago);
      if (extratoAtrasadoElem) extratoAtrasadoElem.innerText = formatarMoeda(totalAtrasado);
      if (extratoInicioElem) extratoInicioElem.innerText = dataInicioFormatada;
      if (extratoTempoElem) extratoTempoElem.innerText = tempoDeCasa;

      modal.style.display = "flex";
    }
  };

  window.verFinanceiroAluno = (nome) => {
    window.location.href = `financeiro.html?filtro=Ativo&busca=${encodeURIComponent(nome)}`;
  };

  window.imprimirFicha = (id) => {
    window.print();
  };

  window.imprimirRecibo = async (alunoId, ref) => {
    if (!supabaseClient) return;
    mostrarToast("Gerando guia de pagamento...", "info");

    // Busca dados completos do aluno e do pagamento para compor a Guia
    const { data: aluno } = await supabaseClient.from("alunos").select("*").eq("id", alunoId).single();
    const { data: pagto } = await supabaseClient.from("pagamentos").select("*").eq("aluno_id", alunoId).eq("referencia", ref).order('created_at', { ascending: false }).limit(1).single();

    if (!aluno || !pagto) return mostrarToast("Erro ao carregar dados do recebimento.", "error");

    const novaAba = window.open("", "_blank");
    if (!novaAba) return mostrarToast("Pop-up bloqueado pelo navegador.", "error");

    novaAba.document.write(`
      <html>
        <head>
          <title>Guia de Recebimento - Sou Fitness</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; width: 320px; padding: 20px; margin: 0 auto; color: #000; background: #fff; border: 1px solid #eee; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
            .content { font-size: 13px; line-height: 1.5; }
            .row { display: flex; justify-content: space-between; }
            .total-box { font-size: 16px; font-weight: bold; margin-top: 10px; border-top: 2px double #000; padding-top: 8px; }
            .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 20px; font-size: 11px; }
            .btn-print { background: #000; color: #fff; border: none; padding: 10px; cursor: pointer; width: 100%; margin-top: 20px; font-weight: bold; font-family: inherit; }
            @media print { .no-print { display: none; } body { border: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <strong>SOU FITNESS ACADEMIA</strong><br>
            SISTEMA DE GESTÃO INTEGRADO<br>
            *** GUIA DE RECEBIMENTO ***
          </div>
          <div class="content">
            <strong>ALUNO:</strong> ${aluno.nome.toUpperCase()}<br>
            <strong>MATRÍCULA:</strong> ${aluno.matricula || '---'}<br>
            <strong>CPF:</strong> ${aluno.cpf || '---'}<br>
            <strong>RG:</strong> ${aluno.rg || '---'}<br>
            <div style="margin: 15px 0; border-top: 1px solid #ccc;"></div>
            <div class="row"><span>Competência:</span> <span>${pagto.referencia}</span></div>
            <div class="row"><span>Data Pagto:</span> <span>${new Date(pagto.data).toLocaleDateString('pt-BR')}</span></div>
            <div class="row"><span>Método:</span> <span>${pagto.metodo || 'PIX'}</span></div>
            <div class="total-box">
              <span>VALOR PAGO:</span> <span>${formatarMoeda(pagto.valor)}</span>
            </div>
          </div>
          <div class="footer">
            ESTE DOCUMENTO É UM COMPROVANTE DE QUITAÇÃO<br>
            Emitido em: ${new Date().toLocaleString('pt-BR')}<br>
            <button class="btn-print no-print" onclick="window.print()">IMPRIMIR COMPROVANTE</button>
          </div>
        </body>
      </html>
    `);
  };

  window.imprimirGuia = (id, ref) => {
    window.print();
  };

  // Função interna para gerar o payload PIX (BRCode)
  const gerarPayloadPix = async (valor) => {
    const { data: config } = await supabaseClient.from("pix_configs").select("*").limit(1).single();
    if (!config || !config.chave) return null;

    const vStr = parseFloat(valor).toFixed(2);
    // Formatação conforme padrão EMV do PIX (Simplificado para o sistema)
    return `00020126360014BR.GOV.BCB.PIX01${config.chave.length}${config.chave}52040000530398654${vStr.length}${vStr}5802BR59${config.nome.length}${config.nome}60${config.cidade.length}${config.cidade}62070503***6304`;
  };

  window.gerarPix = async (id, valor) => {
    if (!supabaseClient) return;

    const payload = await gerarPayloadPix(valor);
    if (!payload) {
      return mostrarToast("Configure sua chave PIX nas Configurações primeiro!", "error");
    }

    // Abre o relatório/recibo em uma nova aba com o QR Code (usando API externa para o QR)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
    const novaAba = window.open("", "_blank");
    if (!novaAba) return mostrarToast("Pop-up bloqueado pelo navegador.", "error");

    novaAba.document.write(`
      <html>
        <head><title>Pagamento PIX</title><style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f4f4f4;} .btn{padding:10px 20px; cursor:pointer; background:#FFD400; border:none; font-weight:bold; border-radius:5px; margin-top:20px;}</style></head>
        <body>
          <h2>Pagamento via PIX</h2>
          <p>Valor: <strong>${formatarMoeda(valor)}</strong></p>
          <img src="${qrUrl}" alt="QR Code PIX">
          <p style="margin-top:20px; font-size:12px; color:#666;">Aponte a câmera do seu banco para o código acima.</p>
          <button class="btn" onclick="window.print()">Imprimir Recibo</button>
        </body>
      </html>
    `);
  };

  window.copiarPixCobranca = async (alunoId, valor) => {
    const payload = await gerarPayloadPix(valor);
    if (!payload) return mostrarToast("Configure sua chave PIX primeiro.", "error");

    try {
      await navigator.clipboard.writeText(payload);
      mostrarToast("Código PIX Copia e Cola copiado!");
    } catch (err) {
      mostrarToast("Erro ao copiar código PIX.", "error");
    }
  };

  window.enviarWhatsAppCobranca = async (alunoId, valor, ref) => {
    const { data: aluno } = await supabaseClient.from("alunos").select("nome, whatsapp").eq("id", alunoId).single();
    if (!aluno || !aluno.whatsapp) return mostrarToast("WhatsApp do aluno não cadastrado.", "error");

    const payload = await gerarPayloadPix(valor);
    if (!payload) return mostrarToast("Configure sua chave PIX primeiro.", "error");

    const msg = `Olá *${aluno.nome}*! 👋\nSeguem os dados para pagamento da mensalidade de *${ref}* no valor de *${formatarMoeda(valor)}*.\n\n*Código PIX Copia e Cola:*\n${payload}`;
    const fone = aluno.whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  window.togglePagamento = (id) => {
    mostrarToast("Funcionalidade de estorno em desenvolvimento.", "info");
  };

  window.exportarDados = () => {
    mostrarToast("Exportação de backup em desenvolvimento.", "info");
  };

  window.importarDados = (input) => {
    mostrarToast("Importação de backup em desenvolvimento.", "info");
  };

  window.verificarGeracaoMensalidades = async () => {
    if (!supabaseClient) return;
    mostrarToast("Iniciando geração manual...", "info");
    
    // Chama a função RPC que criamos no banco de dados
    const { error } = await supabaseClient.rpc('gerar_mensalidades_automaticas');
    
    if (error) {
      console.error(error);
      mostrarToast("Erro ao gerar mensalidades no servidor.", "error");
    } else {
      mostrarToast("Processamento concluído no banco de dados!");
      await carregarAlunos();
    }
  };

  const calcularPendenciasHistoricas = (aluno) => ({ meses: [], total: 0 }); // [cite: 948]

  // Global variable to store available plans
  window.planosDisponiveis = [];

  window.inicializarPlanos = async () => {
    if (!supabaseClient) {
      console.error("Supabase não inicializado para carregar planos.");
      return;
    }

    const selectPlano = document.getElementById("plano");
    const inputValor = document.getElementById("valor");

    if (selectPlano) {
      const { data: planos, error } = await supabaseClient
        .from("planos")
        .select("*")
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar planos do Supabase:", error);
        mostrarToast("Erro ao carregar planos.", "error");
        return;
      }

      window.planosDisponiveis = planos; // Store globally

      const valorAtual = selectPlano.value;
      selectPlano.innerHTML = '<option value="">Selecione um plano...</option>';
      
      planos.forEach(p => {
        const option = document.createElement("option");
        option.value = p.nome;
        option.text = p.nome;
        option.dataset.valor = p.valor; // Store value in dataset for easy access
        if (p.nome === valorAtual) option.selected = true;
        selectPlano.appendChild(option);
      });

      // Sincroniza o campo de valor quando o plano é alterado manualmente
      selectPlano.onchange = (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (selectedOption && selectedOption.dataset.valor && inputValor) {
          inputValor.value = formatarMoeda(selectedOption.dataset.valor);
        }
      };
    }
  };

  // Funções para Configurações (PIX e Planos)
  window.salvarConfigPix = async () => {
    if (!supabaseClient) return mostrarToast("Supabase não inicializado.", "error");

    const chave = document.getElementById('cfg_pix_chave').value;
    const nome = document.getElementById('cfg_pix_nome').value;
    const cidade = document.getElementById('cfg_pix_cidade').value;

    try {
      // Tenta buscar uma configuração existente (assumindo apenas uma)
      const { data: existingConfig, error: fetchError } = await supabaseClient
        .from('pix_configs')
        .select('*')
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
        throw fetchError;
      }

      if (existingConfig) {
        // Atualiza a configuração existente
        const { error: updateError } = await supabaseClient
          .from('pix_configs')
          .update({ chave, nome, cidade })
          .eq('id', existingConfig.id);
        if (updateError) throw updateError;
      } else {
        // Insere uma nova configuração
        const { error: insertError } = await supabaseClient
          .from('pix_configs')
          .insert([{ chave, nome, cidade }]);
        if (insertError) throw insertError;
      }
      mostrarToast('Configurações PIX salvas com sucesso!');
    } catch (error) {
      console.error("Erro ao salvar configurações PIX:", error);
      mostrarToast('Erro ao salvar configurações PIX: ' + error.message, 'error');
    }
  };

  window.carregarConfigPix = async () => {
    if (!supabaseClient) return;
    try {
      const { data: config, error } = await supabaseClient
        .from('pix_configs')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }

      if (config) {
        document.getElementById('cfg_pix_chave').value = config.chave || '';
        document.getElementById('cfg_pix_nome').value = config.nome || '';
        document.getElementById('cfg_pix_cidade').value = config.cidade || '';
      }
    } catch (error) {
      console.error("Erro ao carregar configurações PIX:", error);
      mostrarToast('Erro ao carregar configurações PIX: ' + error.message, 'error');
    }
  };

  window.salvarPlano = async (planoData) => {
    if (!supabaseClient) return mostrarToast("Supabase não inicializado.", "error");
    try {
      if (planoData.id) {
        const { error } = await supabaseClient.from('planos').update({ nome: planoData.nome, valor: planoData.valor }).eq('id', planoData.id);
        if (error) throw error;
        mostrarToast('Plano atualizado com sucesso!');
      } else {
        const { error } = await supabaseClient.from('planos').insert([{ nome: planoData.nome, valor: planoData.valor }]);
        if (error) throw error;
        mostrarToast('Plano salvo com sucesso!');
      }
      window.carregarTabelaPlanosConfig();
      window.inicializarPlanos(); // Atualiza o select de planos em outras páginas
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
      mostrarToast('Erro ao salvar plano: ' + error.message, 'error');
    }
  };

  window.carregarTabelaPlanosConfig = async () => {
    if (!supabaseClient) return;
    try {
      const { data: planos, error } = await supabaseClient
        .from('planos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;

      const tbody = document.getElementById('tabelaConfigPlanos');
      if (!tbody) return;
      tbody.innerHTML = '';
      planos.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `
          <td>${p.nome}</td>
          <td>${formatarMoeda(p.valor)}</td>
          <td>
            <button onclick="editarPlanoConfig('${p.id}')" style="background:none; color:var(--primary); padding:0; margin-right:10px;" title="Editar">✏️</button>
            <button onclick="removerPlanoConfig('${p.id}')" style="background:none; color:#ff4444; padding:0;" title="Remover">🗑️</button>
          </td>
        `;
      });
    } catch (error) {
      console.error("Erro ao carregar planos na tabela:", error);
      mostrarToast('Erro ao carregar planos na tabela: ' + error.message, 'error');
    }
  };

  window.editarPlanoConfig = async (id) => {
    if (!supabaseClient) return;
    try {
      const { data: plano, error } = await supabaseClient
        .from('planos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (plano) {
        document.getElementById('plano_nome').value = plano.nome;
        document.getElementById('plano_valor').value = plano.valor.toFixed(2).replace('.', ',');
        window.editPlanoId = id; // Use window.editPlanoId to make it global
        document.querySelector('#formPlano button[type="submit"]').innerText = '💾 Atualizar Plano';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      console.error("Erro ao carregar plano para edição:", error);
      mostrarToast('Erro ao carregar plano para edição: ' + error.message, 'error');
    }
  };

  window.removerPlanoConfig = async (id) => {
    if (!supabaseClient) return mostrarToast("Supabase não inicializado.", "error");
    if (!confirm("Tem certeza que deseja remover este plano?")) return;
    try {
      const { error } = await supabaseClient.from('planos').delete().eq('id', id);
      if (error) throw error;
      mostrarToast('Plano removido com sucesso!');
      window.carregarTabelaPlanosConfig();
      window.inicializarPlanos(); // Atualiza o select de planos em outras páginas
    } catch (error) {
      console.error("Erro ao remover plano:", error);
      mostrarToast('Erro ao remover plano: ' + error.message, 'error');
    }
  };

  // =========================================================================
  // FLUXO DE PAGAMENTOS E FINANCEIRO
  // =========================================================================
  window.confirmarPagamentoCobranca = async (cobrancaId) => {
    // [cite: 954]
    const inputData = document.getElementById(`data_cob_${cobrancaId}`); // [cite: 955]
    if (!inputData || !inputData.value) {
      // [cite: 956]
      alert("Por favor, selecione a data do recebimento."); // [cite: 957]
      return; // [cite: 958]
    }
    const dataInput = inputData.value; // [cite: 960]
    const [ano, mes, dia] = dataInput.split("-"); // [cite: 961]
    const dataFormatada = `${dia}/${mes}/${ano}`; // [cite: 962]
    // Busca a cobrança no Supabase primeiro
    const { data: cob, error: errFetch } = await supabaseClient.from("cobrancas").select("*").eq("id", cobrancaId).single();
    if (errFetch || !cob) return mostrarToast("Cobrança não encontrada.", "error");

    // 1. Salva no Supabase (Histórico Real)
    const { error: errInsert } = await supabaseClient.from("pagamentos").insert([{
      aluno_id: cob.aluno_id,
      nome: cob.nome,
      valor: cob.valor,
      data: dataInput,
      referencia: cob.competencia
    }]);

    if (errInsert) return mostrarToast("Erro ao salvar histórico.", "error");

    // 2. Remove a cobrança do banco (pois foi paga)
    await supabaseClient.from("cobrancas").delete().eq("id", cobrancaId);

    mostrarToast("Pagamento recebido com sucesso!");
    carregarAlunos();
    // Atualiza a ficha do aluno para liberar o acesso ao ícone de Guia/Recibo
    window.exibirExtratoAluno(cob.aluno_id);
  };

  window.confirmarPagamento = async (id) => {
    atualizarVariaveisFiltro();
    const valorInput = document.getElementById(`val_${id}`);
    const dataInput = document.getElementById(`data_${id}`);
    
    if (!valorInput || !dataInput || !dataInput.value) return mostrarToast("Selecione a data.", "error");

    // Busca o aluno para pegar o nome
    const { data: aluno } = await supabaseClient.from("alunos").select("nome").eq("id", id).single();

    // Em vez de usar localStorage, criamos a cobrança no Supabase se ela não existir
    const { data: novaCob, error } = await supabaseClient.from("cobrancas").insert([{
      aluno_id: id,
      nome: aluno.nome,
      valor: limparMoeda(valorInput.value),
      vencimento: dataInput.value,
      competencia: refFiltro,
      status: 'PENDENTE'
    }]).select().single();

    if (error) return mostrarToast("Erro ao gerar cobrança: " + error.message, "error");
    
    await window.confirmarPagamentoCobranca(novaCob.id);
  };

  // =========================================================================
  // RENDERIZAÇÃO E FILTRAGEM (DIRETO DO SUPABASE)
  // =========================================================================
  const carregarAlunos = async () => {
    // [cite: 999]
    atualizarVariaveisFiltro();

    // Captura o termo de busca no INÍCIO para evitar erros de referência
    const termoBusca = normalizarTexto(
      document.getElementById("buscaNome")?.value || ""
    );

    if (!supabaseClient) {
      // [cite: 1000]
      console.error("Supabase não inicializado."); // [cite: 1001]
      return; // [cite: 1002]
    }

    const { data: alunos, error } = await supabaseClient // [cite: 1005]
      .from("alunos") // [cite: 1006]
      .select("*") // [cite: 1007]
      .order("nome", { ascending: true }); // [cite: 1008]

    if (error) {
      // [cite: 1009]
      console.error("Erro ao carregar alunos do Supabase:", error); // [cite: 1010]
      mostrarToast("Erro ao carregar lista de alunos.", "error"); // [cite: 1011]
      return; // [cite: 1012]
    }

    // Busca os pagamentos do Supabase para o mês de referência atual
    const { data: pagamentosDb } = await supabaseClient.from("pagamentos").select("*").eq("referencia", refFiltro);
    const pagamentos = pagamentosDb || [];

    // Preenche a lista de seleção no Financeiro
    const listaSelecao = document.getElementById("listaSelecaoAlunos");
    if (listaSelecao) {
        listaSelecao.innerHTML = "";
        const alunosFiltrados = alunos.filter(aluno => 
            !termoBusca || normalizarTexto(aluno.nome).includes(termoBusca)
        );

        alunosFiltrados.forEach(aluno => {
            const item = document.createElement("div");
            item.className = "aluno-item-card";
            item.onclick = () => {
                document.querySelectorAll('.aluno-item-card').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                window.exibirExtratoAluno(aluno.id);
            };
            item.innerHTML = `
                <div class="aluno-avatar-circle">${aluno.nome.charAt(0).toUpperCase()}</div>
                <div>
                    <strong style="display:block;">${aluno.nome}</strong>
                    <small style="color:var(--muted)">${aluno.plano}</small>
                </div>
            `;
            listaSelecao.appendChild(item);
        });
    }

    const totalMatriculados = alunos.length; // [cite: 1015]
    const ativos = alunos.filter((a) => a.status === true).length; 

    if (document.getElementById("totalAlunos"))
      document.getElementById("totalAlunos").innerText = totalMatriculados;
    if (document.getElementById("alunosAtivos"))
      document.getElementById("alunosAtivos").innerText = ativos; // [cite: 1018]

    if (
      window.location.pathname.includes("financeiro.html") && // [cite: 1098]
      !urlParams.has("filtro") && 
      !termoBusca // [cite: 1100]
    ) {
      filtroStatus = "Ativo"; // [cite: 1102]
    }
    const isFiltrandoTodos = filtroStatus === "Todos" || !filtroStatus;

    if (tabelaAlunos) {
      // [cite: 1023]
      tabelaAlunos.innerHTML = ""; // [cite: 1024]

      const tabHoje = document.getElementById("tabelaHoje"); // [cite: 1106]
      const tabAtraso = document.getElementById("tabelaAtraso"); // [cite: 1107]
      const tabProximos = document.getElementById("tabelaProximos"); // [cite: 1108]
      
      // Converte o filtro de status para booleano para comparação correta
      const statusFiltroBooleano = filtroStatus === "Ativo" || filtroStatus === "true";

      // Agora buscamos as cobranças do Supabase para exibir no financeiro
      const { data: cobrancasDb } = await supabaseClient.from("cobrancas").select("*");
      const cobrancas = cobrancasDb || [];

      const hojeIso = new Date().toISOString().split("T")[0]; // [cite: 1110]

      if (tabHoje && tabAtraso && tabProximos) {
        // [cite: 1111]
        tabHoje.innerHTML = tabAtraso.innerHTML = tabProximos.innerHTML = ""; // [cite: 1112]
        cobrancas.forEach((cob) => {
          const aluno = alunos.find((a) => a.id === cob.aluno_id); 
          if (
            !aluno ||
            (termoBusca && !normalizarTexto(aluno.nome).includes(termoBusca))
          )
            return; // [cite: 1115, 1117, 1119]

          // No Financeiro, as seções de cobrança (Atraso/Hoje) devem mostrar o aluno 
          // independente do status, pois uma dívida pendente deve ser visível para cobrança.

          if (cob.status === "ATRASADO") {
            // [cite: 1121]
            adicionarLinhaTabelaSegmentada(tabAtraso, aluno, cob); // [cite: 1122]
          } else if (cob.status === "PENDENTE" && cob.vencimento === hojeIso) {
            // [cite: 1123]
            adicionarLinhaTabelaSegmentada(tabHoje, aluno, cob); // [cite: 1124]
          } else if (cob.status === "FUTURA" && cob.competencia === refFiltro) {
            // [cite: 1125]
            adicionarLinhaTabelaSegmentada(tabProximos, aluno, cob); // [cite: 1126]
          }
        });
      }

      let alunosParaExibir = alunos; // [cite: 1130]
      if (termoBusca) {
        // [cite: 1131]
        alunosParaExibir = alunosParaExibir.filter((a) =>
          normalizarTexto(a.nome).includes(termoBusca)
        ); // [cite: 1132, 1133]
      }
      // Aplica o filtro de status apenas se NÃO houver uma pesquisa por nome
      if (!isFiltrandoTodos && !termoBusca) {
        // [cite: 1136]
        const statusFiltroBooleano = filtroStatus === "Ativo" || filtroStatus === "true";
        alunosParaExibir = alunosParaExibir.filter(
          (a) => a.status === statusFiltroBooleano
        );
      }
      if (filtroPagamento) {
        // [cite: 1141]
        const diaHoje = new Date().getDate(); // [cite: 1142]
        alunosParaExibir = alunosParaExibir.filter((a) => {
          // [cite: 1143]
          const pago = pagamentos.some(
            (p) => p.aluno_id === a.id && p.referencia === refFiltro
          ); // [cite: 1144, 1145]
          return filtroPagamento === "atraso" // [cite: 1147]
            ? !pago && diaHoje > (parseInt(a.vencimento) || 31) // [cite: 1148]
            : pago || diaHoje <= (parseInt(a.vencimento) || 31); // [cite: 1149]
        });
      }

      const idParaEditar = urlParams.get("edit"); // [cite: 1153]
      if (idParaEditar && !editId) {
        // [cite: 1154]
        setTimeout(() => {
          // [cite: 1155]
          if (typeof window.editarAluno === "function")
            window.editarAluno(idParaEditar); // [cite: 1156, 1157]
        }, 100); // [cite: 1158]
      }

      const tabelaInadimplentes = document.getElementById(
        "tabelaInadimplentes"
      ); // [cite: 1161, 1162]
      if (tabelaInadimplentes) {
        // [cite: 1164]
        tabelaInadimplentes.innerHTML = ""; // [cite: 1165]
        alunos.forEach((aluno) => {
          // [cite: 1166]
          const hist = calcularPendenciasHistoricas(aluno); // [cite: 1167]
          if (hist.meses.length > 0) adicionarLinhaInadimplente(aluno, hist); // [cite: 1168]
        });
      }

      alunosParaExibir.forEach((aluno) => adicionarLinhaTabela(aluno, pagamentos));
    }
  };

  // =========================================================================
  // ENVIO DO FORMULÁRIO (GRAVAÇÃO COMPLETA NO SUPABASE)
  // =========================================================================
  if (form) {
    // [cite: 1039]
    form.addEventListener("submit", async (e) => {
      // [cite: 1040]
      e.preventDefault(); // [cite: 1041]
      if (!supabaseClient) {
        // [cite: 1042]
        alert("Erro: Conexão com o Supabase indisponível."); // [cite: 1043]
        return; // [cite: 1044]
      }

      // Garante que a matrícula não esteja vazia
      let matriculaValor = document.getElementById("matricula")?.value.trim();
      if (!matriculaValor) {
        matriculaValor = "MAT" + Date.now().toString().slice(-8);
      }

      const valorLimpo = limparMoeda(document.getElementById("valor").value); // [cite: 1046]
      const dadosAluno = {
        // [cite: 1048]
        nome: document.getElementById("nome").value, // [cite: 1049]
        matricula: matriculaValor,
        cpf: document.getElementById("cpf").value || null, // [cite: 1050]
        rg: document.getElementById("rg")?.value || null,
        responsavel: document.getElementById("responsavel")?.value || null,
        nascimento: document.getElementById("nascimento").value || null, // [cite: 1051]
        sexo: document.getElementById("sexo").value, // [cite: 1052]
        estado_civil: document.getElementById("estadoCivil").value,
        celular: document.getElementById("celular").value || null, // [cite: 1054]
        whatsapp: document.getElementById("whatsapp").value || null, // [cite: 1055]
        email: document.getElementById("email").value || null, // [cite: 1056]
        plano: document.getElementById("plano").value, // [cite: 1057]
        valor_mensalidade: valorLimpo,
        status: document.getElementById("status").checked, // Envia true para Ativo e false para Inativo
        vencimento: parseInt(document.getElementById("vencimento").value) || 10, // [cite: 1060]
        peso: pesoInput && pesoInput.value ? parseFloat(pesoInput.value.toString().replace(",", ".")) : null,
        altura:
          alturaInput && alturaInput.value
            ? (() => {
                let alt = parseFloat(alturaInput.value.toString().replace(",", "."));
                return alt > 3 ? alt / 100 : alt; // Se digitar 175, converte para 1.75
              })()
            : null,
        imc: imcInput && imcInput.value 
          ? parseFloat(imcInput.value.split(" - ")[0]) || null // Envia apenas o número (ex: 22.50)
          : null,
      };

      try {
        // [cite: 1065]
        if (editId) {
          // [cite: 1066]
          const { error: errorUpdate } = await supabaseClient // [cite: 1068]
            .from("alunos") // [cite: 1069]
            .update(dadosAluno) // [cite: 1070]
            .eq("id", editId); // [cite: 1071]

          if (errorUpdate) throw errorUpdate; // [cite: 1072]
          editId = null; // [cite: 1073]
        } else {
          const novoAluno = { ...dadosAluno };
          const { error: errorInsert } = await supabaseClient // [cite: 1080]
            .from("alunos") // [cite: 1081]
            .insert([novoAluno]); // [cite: 1082]

          if (errorInsert) throw errorInsert; // [cite: 1083]
        }

        mostrarToast("Aluno salvo com sucesso!"); 
        form.reset(); // [cite: 1086]
        gerarMatriculaAutomatica(); // Gera uma nova para o próximo cadastro
        await window.verificarGeracaoMensalidades(); // GERA A PARCELA DO MÊS ATUAL NA HORA
        if (imcInput) imcInput.value = ""; // [cite: 1087]
        await carregarAlunos(); // [cite: 1089]
      } catch (erroBanco) {
        // [cite: 1090]
        console.error("Erro interno do Supabase:", erroBanco); // [cite: 1091]
        
        let mensagemAmigavel = erroBanco.message;
        if (erroBanco.code === '42501') {
          mensagemAmigavel = "Erro de Permissão (RLS): Vá ao painel do Supabase e habilite as Políticas de Acesso (Policies) para a tabela 'alunos'.";
        }

        mostrarToast(`Não foi possível salvar: ${mensagemAmigavel}`, 'error'); //
      }
    });
  }

  // =========================================================================
  // FUNÇÕES DE EDIÇÃO E REMOÇÃO (ESCOPO GLOBAL)
  // =========================================================================
  window.editarAluno = async (id) => {
    if (!supabaseClient) return;
    
    const { data: aluno, error } = await supabaseClient
      .from("alunos")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !aluno) {
      mostrarToast("Erro ao carregar dados do aluno.", "error");
      return;
    }

    // Preenche o formulário com os dados do banco
    const campos = {
      "nome": aluno.nome,
      "matricula": aluno.matricula,
      "cpf": aluno.cpf,
      "rg": aluno.rg,
      "responsavel": aluno.responsavel,
      "nascimento": aluno.nascimento,
      "sexo": aluno.sexo,
      "estadoCivil": aluno.estado_civil,
      "celular": aluno.celular,
      "whatsapp": aluno.whatsapp,
      "email": aluno.email,
      "vencimento": aluno.vencimento,
      "peso": aluno.peso,
      "altura": aluno.altura,
      "imc": aluno.imc
    };

    Object.keys(campos).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = campos[id] || "";
    });

    if (document.getElementById("matricula")) document.getElementById("matricula").value = aluno.matricula || "";
    document.getElementById("cpf").value = aluno.cpf || "";
    document.getElementById("nascimento").value = aluno.nascimento || "";
    document.getElementById("sexo").value = aluno.sexo || "Masculino";
    document.getElementById("estadoCivil").value = aluno.estado_civil || "Solteiro";
    document.getElementById("celular").value = aluno.celular || "";
    document.getElementById("whatsapp").value = aluno.whatsapp || "";
    document.getElementById("email").value = aluno.email || "";
    // Set plano based on fetched plans
    const selectPlano = document.getElementById("plano");
    if (selectPlano) {
      selectPlano.value = aluno.plano || "";
      selectPlano.dispatchEvent(new Event('change')); // Trigger change to update valor_mensalidade
    }
    document.getElementById("valor").value = formatarMoeda(aluno.valor_mensalidade || 0);
    document.getElementById("vencimento").value = aluno.vencimento || 10;
    document.getElementById("status").checked = aluno.status === true;
    if (pesoInput) pesoInput.value = aluno.peso || "";
    if (alturaInput) alturaInput.value = aluno.altura || "";
    if (imcInput) imcInput.value = aluno.imc || "";

    editId = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
    mostrarToast("Modo de edição ativado.");
  };

  window.atualizarStatus = async (id, novoStatus) => {
    if (!supabaseClient) return;
    
    const { error } = await supabaseClient
      .from("alunos")
      .update({ status: novoStatus })
      .eq("id", id);

    if (error) mostrarToast("Erro ao atualizar: " + error.message, "error");
    else mostrarToast("Status atualizado com sucesso!");
  };

  window.removerAluno = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este aluno definitivamente?")) return;
    
    const { error } = await supabaseClient.from("alunos").delete().eq("id", id);
    if (error) {
      mostrarToast("Erro ao excluir aluno: " + error.message, "error");
    } else {
      mostrarToast("Aluno removido com sucesso!");
      await carregarAlunos();
    }
  };

  // =========================================================================
  // MANIPULAÇÃO DO DOM / COMPONENTES DE TABELA
  // =========================================================================
  const adicionarLinhaTabela = (aluno, pagamentos = []) => {
    // [cite: 1177]
    if (!tabelaAlunos) return; // [cite: 1178]
    const pagoEsteMes = pagamentos.some(
      (p) => p.aluno_id === aluno.id && p.referencia === refFiltro
    ); // [cite: 1186, 1187]
    const novaLinha = tabelaAlunos.insertRow(); // [cite: 1189]
    const isManagementPage =
      window.location.pathname.includes("alunosativos.html") ||
      window.location.pathname.includes("financeiro.html"); // [cite: 1190, 1191, 1192]

    let colStatus = `
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label class="switch">
            <input type="checkbox" onchange="atualizarStatus('${aluno.id}', this.checked)" ${aluno.status === true ? "checked" : ""}>
            <span class="slider-toggle"></span>
          </label>
          <span style="font-size: 13px; font-weight: 500; color: ${aluno.status === true ? "var(--success)" : "#EF4444"}">
            ${aluno.status === true ? "Ativo" : "Inativo"}
          </span>
        </div>
      </td>
    `; // [cite: 1193, 1205]

    let colExtra = ""; // [cite: 1206]
    if (isManagementPage) {
      // [cite: 1207]
      const venc = aluno.vencimento || "-"; // [cite: 1208]
      const diaHoje = new Date().getDate(); // [cite: 1209]
      const vencNum = parseInt(aluno.vencimento) || 31; // [cite: 1210]
      const atrasado = !pagoEsteMes && diaHoje > vencNum; // [cite: 1211]
      const pagStatusText = pagoEsteMes
        ? "Pago"
        : atrasado
          ? "Atrasado"
          : "Pendente"; // [cite: 1212, 1215, 1216]
      const pagClass = pagoEsteMes
        ? "pago"
        : atrasado
          ? "atrasado"
          : "pendente"; // [cite: 1217, 1220, 1221]

      colStatus = `
        <td>
          <select onchange="atualizarStatus('${aluno.id}', this.value === 'true')" class="status-select">
            <option value="true" ${aluno.status === true ? "selected" : ""}>Ativo</option>
            <option value="false" ${aluno.status === false ? "selected" : ""}>Inativo</option>
          </select>
        </td>
      `; // [cite: 1222, 1230]

      if (window.location.pathname.includes("financeiro.html")) {
        // [cite: 1232]
        if (pagoEsteMes) {
          // [cite: 1233]
          const p = pagamentos.find(
            (pay) => pay.aluno_id === aluno.id && pay.referencia === refFiltro
          ); // [cite: 1234, 1235]
          colExtra = `
            <td>Dia ${venc}</td>
            ${colStatus}
            <td>
              <div style="font-size: 12px; color: var(--success); font-weight: bold; margin-bottom: 5px;">
                ${p.data} - ${formatarMoeda(p.valor_mensalidade || p.valor)}
              </div>
              <div style="display: flex; gap: 5px;">
                <button onclick="imprimirRecibo('${aluno.id}', '${refFiltro}')" class="badge-pagamento pago" style="flex:1;"> 📄 Recibo</button>
                <button onclick="togglePagamento('${aluno.id}')" class="badge-pagamento atrasado" style="flex:1;"> 🔄 Estornar</button>
              </div>
            </td>
          `; // [cite: 1237, 1248]
        } else {
          // [cite: 1250]
          const hojeReal = new Date(); // [cite: 1251]
          const isMesAtual =
            mesFiltro ==
              (hojeReal.getMonth() + 1).toString().padStart(2, "0") &&
            anoFiltro == hojeReal.getFullYear(); // [cite: 1252, 1253, 1254, 1255]
          const dataSugerida = isMesAtual
            ? hojeReal.toISOString().split("T")[0]
            : `${anoFiltro}-${mesFiltro}-01`; // [cite: 1256, 1257, 1258]
          colExtra = `
            <td>Dia ${venc}</td>
            ${colStatus}
            <td>
              <div style="display: flex; flex-direction: column; gap: 5px;">
                <input type="date" id="data_${aluno.id}" value="${dataSugerida}" style="padding: 5px; font-size: 12px; height: 30px; width: 100%;">
                <input type="text" id="val_${aluno.id}" value="${formatarMoeda(aluno.valor_mensalidade)}" style="padding: 5px; font-size: 12px; height: 30px; width: 100%;">
                <div style="display: flex; gap: 5px;">
                  <button onclick="gerarPix('${aluno.id}', '${aluno.valor_mensalidade}')" class="badge-pagamento pendente" style="background:#7c3aed; flex:1;">PIX</button>
                  <button onclick="enviarWhatsAppPix('${aluno.id}', '${aluno.valor_mensalidade}', '${refFiltro}')" class="badge-pagamento pago" style="background:#22c55e; min-width:35px;" title="Enviar pelo WhatsApp"> 📱 </button>
                  <button onclick="confirmarPagamento('${aluno.id}')" class="badge-pagamento pago" style="flex:1;"> ✅ Pagar</button>
                  <button onclick="imprimirGuia('${aluno.id}', '${refFiltro}')" class="badge-pagamento pendente" style="flex:1;"> 🖨️ Guia</button>
                </div>
              </div>
            </td>
          `; // [cite: 1259, 1274]
        }
      } else {
        // [cite: 1276]
        colExtra = `
          <td>Dia ${venc}</td>
          ${colStatus}
          <td>
            <button onclick="togglePagamento('${aluno.id}')" class="badge-pagamento ${pagClass}">
              ${pagStatusText}
            </button>
          </td>
        `; // [cite: 1277, 1286]
      }
    } else {
      // [cite: 1287]
      colExtra = colStatus; // [cite: 1288]
    }

    novaLinha.innerHTML = `
      <td>${aluno.nome}</td>
      <td>${aluno.matricula || "---"}</td>
      <td>${aluno.plano}</td>
      <td>${formatarMoeda(aluno.valor_mensalidade)}</td>
      ${colExtra}
      <td>
        <button onclick="exibirExtratoAluno('${aluno.id}')" title="Histórico Financeiro" style="background:none; border:none; cursor:pointer; color:#7c3aed; margin-right: 8px;"> 📜 </button>
        <button onclick="verFinanceiroAluno('${aluno.nome}')" title="Filtrar no Financeiro" style="background:none; border:none; cursor:pointer; color:#22C55E; margin-right: 8px;"> 💰 </button>
        <button onclick="editarAluno('${aluno.id}')" style="background:none; border:none; cursor:pointer; color:var(--primary); margin-right: 8px;"> ✏️ </button>
        <button onclick="imprimirFicha('${aluno.id}')" title="Imprimir Ficha" style="background:none; border:none; cursor:pointer; color:#3b82f6; margin-right: 8px;"> 🖨️ </button>
        <button onclick="removerAluno('${aluno.id}')" style="background:none; border:none; cursor:pointer; color:#ff4444;"> 🗑️ </button>
      </td>
    `; // [cite: 1290, 1303]
  };

  const adicionarLinhaInadimplente = (aluno, hist) => {
    // [cite: 1305]
    const tabela = document.getElementById("tabelaInadimplentes"); // [cite: 1306]
    if (!tabela) return; // [cite: 1307]
    const row = tabela.insertRow(); // [cite: 1308]
    row.innerHTML = `
      <td><strong>${aluno.nome}</strong></td>
      <td style="color: #EF4444; font-weight: bold;">${hist.meses.length} mês(es)</td>
      <td><small>${hist.meses.join(", ")}</small></td>
      <td style="font-weight: bold; color: #EF4444;">${formatarMoeda(hist.total)}</td>
      <td>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button onclick="exibirExtratoAluno('${aluno.id}')" title="Histórico Financeiro" style="background:none; border:none; cursor:pointer; color:#7c3aed;"> 📜 </button>
          <button onclick="verFinanceiroAluno('${aluno.nome}')" class="badge-pagamento atrasado" style="width:100%">Ir para Acerto</button>
        </div>
      </td>
    `; // [cite: 1309, 1320]
  };

  const adicionarLinhaTabelaSegmentada = (tabela, aluno, cobranca) => {
    // [cite: 1322]
    const row = tabela.insertRow(); // [cite: 1323]
    const dataSugerida = new Date().toISOString().split("T")[0]; // [cite: 1324]
    const statusColor =
      cobranca.status === "ATRASADO"
        ? "#EF4444"
        : cobranca.status === "PENDENTE"
          ? "#F59E0B"
          : "#64748b"; // [cite: 1325, 1328, 1330]
    // const vencFormatado = cobranca.vencimento.split("-").reverse().join("/"); // [cite: 1331]

    row.innerHTML = `
      <td><strong>${aluno.nome}</strong></td>
      <td>${aluno.matricula || "---"}</td>
      <td>${aluno.plano}</td>
      <td>${formatarMoeda(cobranca.valor)}</td>
      <td>Dia ${aluno.vencimento || "-"} <br> <small style="color: ${statusColor}">${cobranca.competencia}</small></td>
      <td>
        <div style="display: flex; gap: 5px; align-items: center;" class="no-print">
          <button onclick="exibirExtratoAluno('${aluno.id}')" title="Ficha Financeira e Funcional" style="background:none; border:none; cursor:pointer; color:#7c3aed; margin-right: 5px;"> 📜 </button>
          <input type="date" id="data_cob_${cobranca.id}" value="${dataSugerida}" style="padding: 4px; font-size: 12px; width: 125px; background: #0f172a; border: 1px solid var(--border); color: white; cursor: pointer; border-radius: 6px;">
          <button onclick="confirmarPagamentoCobranca('${cobranca.id}')" class="badge-pagamento pago"> ✅ Receber</button>
        </div>
      </td>
    `; // [cite: 1332, 1344]
  };

  // =========================================================================
  // LOGICA DE SAÚDE / CÁLCULO DE IMC
  // =========================================================================
  const calcularIMC = () => {
    // [cite: 1349]
    if (!pesoInput || !alturaInput || !imcInput) return; // [cite: 1350]
    const peso = parseFloat(pesoInput.value.toString().replace(",", ".")); // [cite: 1351]
    let altura = parseFloat(alturaInput.value.toString().replace(",", ".")); // [cite: 1352]
    if (peso > 0 && altura > 0) {
      // [cite: 1353]
      if (altura > 3) altura = altura / 100; // Trata centímetros // [cite: 1354]
      const imc = (peso / (altura * altura)).toFixed(2); // [cite: 1355]
      let classe = ""; // [cite: 1356]
      if (imc < 18.5)
        classe = "Abaixo do peso"; // [cite: 1357]
      else if (imc < 25)
        classe = "Peso Normal"; // [cite: 1358]
      else if (imc < 30)
        classe = "Sobrepeso"; // [cite: 1359]
      else if (imc < 35)
        classe = "Obesidade Grau I"; // [cite: 1360]
      else if (imc < 40)
        classe = "Obesidade Grau II"; // [cite: 1361]
      else classe = "Obesidade Grau III"; // [cite: 1362]
      imcInput.value = `${imc} - ${classe}`; // [cite: 1363]
    } else {
      // [cite: 1364]
      imcInput.value = ""; // [cite: 1365]
    }
  };

  if (pesoInput) pesoInput.addEventListener("input", calcularIMC); // [cite: 1368]
  if (alturaInput) alturaInput.addEventListener("input", calcularIMC); // [cite: 1369]


  // Inicialização final corrigida para evitar erros de sintaxe
  window.inicializarPlanos();
  gerarMatriculaAutomatica();
  carregarAlunos().then(() => {
    const buscaInput = document.getElementById("buscaNome");
    if (buscaInput) {
      buscaInput.addEventListener("input", carregarAlunos);
    }
  });
});
