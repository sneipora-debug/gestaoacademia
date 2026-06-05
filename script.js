document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formAluno");
  const pesoInput = document.getElementById("peso");
  const alturaInput = document.getElementById("altura");
  const imcInput = document.getElementById("imc");
  const tabelaAlunos = document.getElementById("tabelaAlunos");
// ss
  let chartInstance = null; // Armazena a instância do gráfico para destruí-la antes de recriar
  let editId = null; // Controla se estamos editando um aluno existente

  // --- INICIALIZAÇÃO DE PLANOS ---
  window.inicializarPlanos = () => {
    let planos = JSON.parse(localStorage.getItem("planos"));
    if (!planos) {
      planos = [
        { id: 1, nome: "Musculação", valor: 120 },
        { id: 2, nome: "Premium", valor: 180 },
        { id: 3, nome: "Personal", valor: 250 },
      ];
      localStorage.setItem("planos", JSON.stringify(planos));
    }
    popularSelectPlanos(planos);
  };

  const popularSelectPlanos = (planos) => {
    const select = document.getElementById("plano");
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um plano</option>';
    planos.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.nome;
      opt.dataset.valor = p.valor;
      opt.textContent = `${p.nome} - ${formatarMoeda(p.valor)}`;
      select.appendChild(opt);
    });

    select.addEventListener("change", (e) => {
      const selected = e.target.options[e.target.selectedIndex];
      const vInput = document.getElementById("valor");
      if (vInput && selected.dataset.valor) {
        vInput.value = formatarMoeda(selected.dataset.valor);
      }
    });
  };

  // Função para calcular o CRC16 (necessário para o PIX ser válido)
  const calcCRC16 = (data) => {
    let crc = 0xffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff; // Garante que o valor permaneça em 16 bits
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  };

  // Helper para extrair o payload do PIX
  const obterPayloadPix = (valor, identificador = "") => {
    const config = JSON.parse(localStorage.getItem("config_pix"));
    if (!config || !config.chave) return null;

    // Função interna para remover acentos e caracteres especiais de nomes
    const normalizarParaPix = (str) =>
      str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9 ]/gi, "");

    const valorLimpo = limparMoeda(valor).toFixed(2);
    // Mantém apenas caracteres válidos para chaves PIX (+ para telefone, @ para email, etc)
    const chave = config.chave.replace(/[^\w@.+]/g, "");
    const beneficiario = normalizarParaPix(config.nome || "ACADEMIA")
      .substring(0, 25)
      .toUpperCase();
    const cidade = normalizarParaPix(config.cidade || "CIDADE")
      .substring(0, 15)
      .toUpperCase();
    const format = (id, val) =>
      id + val.length.toString().padStart(2, "0") + val;

    let payload = "000201";
    payload +=
      "26" +
      (22 + chave.length).toString().padStart(2, "0") +
      "0014BR.GOV.BCB.PIX01" +
      chave.length.toString().padStart(2, "0") +
      chave;
    payload += "52040000";
    payload += "5303986";
    payload += format("54", valorLimpo);
    payload += "5802BR";
    payload += format("59", beneficiario);
    payload += format("60", cidade);

    // Adiciona Identificador no campo TXID (Tag 62 -> Subtag 05)
    // O TXID para PIX estático deve ser alfanumérico e sem espaços (máx 25 char)
    const txidValue = normalizarParaPix(identificador || "PAGAMENTO")
      .replace(/\s/g, "")
      .substring(0, 25)
      .toUpperCase();
    const txidTag = format("05", txidValue);
    payload += format("62", txidTag);

    // Adiciona a tag de CRC (63) com tamanho 04, e então calcula o Checksum
    const payloadSemCRC = payload + "6304";
    const crc = calcCRC16(payloadSemCRC);
    const payloadFinal = payloadSemCRC + crc;

    return { payload: payloadFinal, valorFormatado: valorLimpo };
  };

  window.gerarPix = (alunoId, valor) => {
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    const aluno = alunos.find((a) => a.id === alunoId);
    const pix = obterPayloadPix(valor, aluno ? aluno.nome : "");
    if (!pix) {
      mostrarToast(
        "Configure sua chave PIX nas configurações primeiro!",
        "error"
      );
      return;
    }
    exibirModalPix(pix.payload, pix.valorFormatado);
  };

  const exibirModalPix = (payload, valor) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}`;
    const win = window.open("", "PIX", "height=500,width=400");
    win.document.write(`
            <body style="font-family:sans-serif; text-align:center; padding:20px; background:#f4f4f4;">
                <h3>Pagamento PIX</h3>
                <p>Valor: R$ ${valor.replace(".", ",")}</p>
                <img src="${qrUrl}" style="margin:20px 0; border:10px solid #fff; border-radius:10px;">
                <div style="background:#fff; padding:10px; border:1px solid #ddd; word-break:break-all; font-size:12px; margin-bottom:20px;">
                    ${payload}
                </div>
                <button onclick="navigator.clipboard.writeText('${payload}').then(() => alert('Copiado!'))" 
                        style="padding:10px 20px; background:#22c55e; color:#fff; border:none; border-radius:5px; cursor:pointer;">
                    Copiar Código
                </button>
            </body>
        `);
  };

  window.enviarWhatsAppPix = (alunoId, valor, competencia) => {
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    const aluno = alunos.find((a) => a.id === alunoId);
    if (!aluno) return;
    const pix = obterPayloadPix(valor, aluno.nome);
    if (!pix) {
      mostrarToast(
        "Configure sua chave PIX nas configurações primeiro!",
        "error"
      );
      return;
    }
    const telefone = (aluno.whatsapp || aluno.celular || "").replace(/\D/g, "");
    if (!telefone) {
      mostrarToast("Aluno sem telefone cadastrado!", "error");
      return;
    }
    const msg =
      "Olá *" +
      aluno.nome +
      "*! 👋\n\nSegue o código PIX para pagamento da mensalidade de *" +
      competencia +
      "*.\n\n💰 *Valor:* R$ " +
      pix.valorFormatado.replace(".", ",") +
      "\n\n_Favor enviar o comprovante após o pagamento._\n\n📍 *Código PIX (Copia e Cola):*\n\n" +
      pix.payload;
    const link =
      "https://wa.me/55" + telefone + "?text=" + encodeURIComponent(msg);
    window.open(link, "_blank");
  };

  // Helper para formatar valores em Reais (R$)
  const formatarMoeda = (valor) => {
    return parseFloat(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Função para mostrar notificações (Toast)
  const mostrarToast = (msg, tipo = "success") => {
    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  };

  // Máscaras para campos de entrada
  const cpfInput = document.getElementById("cpf");
  const celularInput = document.getElementById("celular");
  const whatsappInput = document.getElementById("whatsapp");

  if (cpfInput) {
    cpfInput.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 9)
        v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
      else if (v.length > 3) v = v.replace(/(\d{3})(\d{3})/, "$1.$2");
      e.target.value = v;
    });
  }

  const aplicarMascaraTelefone = (e) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    else if (v.length > 6)
      v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    e.target.value = v;
  };

  if (celularInput)
    celularInput.addEventListener("input", aplicarMascaraTelefone);
  if (whatsappInput)
    whatsappInput.addEventListener("input", aplicarMascaraTelefone);

  // Helper para converter string de moeda formatada em número decimal
  const limparMoeda = (valor) => {
    if (typeof valor !== "string") return parseFloat(valor || 0);
    return (
      parseFloat(
        valor
          .replace("R$", "")
          .replace(/\./g, "")
          .replace(",", ".")
          .replace(/\u00A0/g, "")
          .trim()
      ) || 0
    );
  };

  // Helper para remover acentos e converter para minúsculo
  const normalizarTexto = (texto) => {
    return (texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  // Helper para calcular débitos pendentes de meses anteriores
  const calcularPendenciasHistoricas = (aluno) => {
    const cobrancas = JSON.parse(localStorage.getItem("cobrancas")) || [];
    const hoje = new Date().toISOString().split("T")[0];
    const pendentes = cobrancas.filter(
      (c) =>
        c.alunoId === aluno.id && c.status !== "PAGO" && c.vencimento < hoje
    );
    return {
      meses: pendentes.map((c) => c.competencia),
      total: pendentes.reduce((acc, c) => acc + limparMoeda(c.valor), 0),
    };
  };

  // --- PROCESSO AUTOMÁTICO DE GERAÇÃO DE COBRANÇAS ---
  const gerarCobrancasAutomaticas = () => {
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    let cobrancas = JSON.parse(localStorage.getItem("cobrancas")) || [];
    const hoje = new Date();
    const hojeIso = hoje.toISOString().split("T")[0];

    // --- LIMPEZA DE ÓRFÃOS ---
    // Remove cobranças de alunos que foram excluídos do sistema
    const idsAlunosExistentes = alunos.map((a) => a.id);
    cobrancas = cobrancas.filter((c) =>
      idsAlunosExistentes.includes(c.alunoId)
    );

    // --- LIMPEZA DE PROJEÇÕES PARA INATIVOS ---
    // Se o aluno desistiu (Inativo), removemos cobranças futuras não pagas.
    // Mantém: o que já pagou (PAGO) e o que deve (ATRASADO até o cancelamento).
    alunos.forEach((a) => {
      if (a.status === "Inativo") {
        // Descobre o mês/ano de cancelamento para ser o limite
        let numLimite = null;
        if (a.dataCancelamento) {
          const partes = a.dataCancelamento.split("/");
          if (partes.length === 3) {
            numLimite = parseInt(partes[2]) * 100 + parseInt(partes[1]);
          }
        }

        cobrancas = cobrancas.filter((c) => {
          if (c.alunoId !== a.id) return true;
          if (c.status === "PAGO") return true; // Mantém os pagos sempre

          // Se temos data de cancelamento, remove meses POSTERIORES ao cancelamento
          if (numLimite !== null) {
            const [mesC, anoC] = c.competencia.split("/").map(Number);
            const numComp = anoC * 100 + mesC;
            if (numComp > numLimite) return false; // Remove meses após o cancelamento
          } else {
            // Sem data de cancelamento: remove apenas cobranças futuras pendentes
            const ehFutura = c.vencimento > hojeIso;
            if (ehFutura && c.status !== "PAGO") return false;
          }

          return true;
        });
      }
    });

    // Determina até quando gerar: hoje + 3 meses OU até o mês selecionado no filtro (o que for maior)
    const mesF =
      parseInt(document.getElementById("filtroMes")?.value) ||
      hoje.getMonth() + 1;
    const anoF =
      parseInt(document.getElementById("filtroAno")?.value) ||
      hoje.getFullYear();
    const dataFiltro = new Date(anoF, mesF - 1, 1);

    // Calcula a diferença de meses entre hoje e o filtro para saber quanto projetar
    const diffMeses =
      (dataFiltro.getFullYear() - hoje.getFullYear()) * 12 +
      (dataFiltro.getMonth() - hoje.getMonth());
    const limiteMeses = Math.max(3, diffMeses);

    alunos.forEach((a) => {
      if (a.status === "Inativo") return; // Não gera nada novo para quem desistiu

      // Data de matrícula: o ID é um timestamp (Date.now() no momento do cadastro)
      const dataMatricula = new Date(parseInt(a.id));
      const anoMatricula = dataMatricula.getFullYear();
      const mesMatricula = dataMatricula.getMonth() + 1; // 1-12

      for (let i = 0; i <= limiteMeses; i++) {
        const dataAlvo = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const mes = dataAlvo.getMonth() + 1;
        const ano = dataAlvo.getFullYear();

        // Ignora meses anteriores ao mês de matrícula do aluno
        if (
          ano < anoMatricula ||
          (ano === anoMatricula && mes < mesMatricula)
        ) {
          continue;
        }

        const competencia = `${mes.toString().padStart(2, "0")}/${ano}`;

        // Verifica se a mensalidade já existe para este aluno neste mês
        const existe = cobrancas.find(
          (c) => c.alunoId === a.id && c.competencia === competencia
        );

        if (!existe) {
          const diaVenc = parseInt(a.vencimento) || 10;
          const dataVenc = new Date(ano, mes - 1, diaVenc);
          const dataVencIso = dataVenc.toISOString().split("T")[0];

          // Define status inicial: se o vencimento for maior que hoje, é FUTURA
          const statusInicial = dataVencIso > hojeIso ? "FUTURA" : "PENDENTE";

          cobrancas.push({
            id: "cob_" + Date.now() + Math.floor(Math.random() * 1000),
            alunoId: a.id,
            nome: a.nome,
            competencia: competencia,
            vencimento: dataVencIso,
            valor: a.valor,
            status: statusInicial,
            dataPagamento: null,
          });
        } else {
          // Sincroniza o valor da mensalidade caso o plano do aluno tenha mudado no cadastro
          if (existe.status !== "PAGO" && existe.valor !== a.valor) {
            existe.valor = a.valor;
          }
        }
      }
    });

    // Remove cobranças anteriores à matrícula que possam ter sido geradas antes desta correção
    cobrancas = cobrancas.filter((c) => {
      const aluno = alunos.find((a) => a.id === c.alunoId);
      if (!aluno) return false;
      const dataMatricula = new Date(parseInt(aluno.id));
      const [mesC, anoC] = c.competencia.split("/").map(Number);
      if (
        anoC < dataMatricula.getFullYear() ||
        (anoC === dataMatricula.getFullYear() && mesC < dataMatricula.getMonth() + 1)
      ) {
        return false; // Descarta cobranças antes da matrícula (exceto as já pagas — mantém)
      }
      return true;
    });

    // Atualiza status para ATRASADO logicamente
    cobrancas = cobrancas.map((c) => {
      if (c.status === "PAGO") return c;

      if (c.vencimento < hojeIso) return { ...c, status: "ATRASADO" };
      if (c.vencimento === hojeIso) return { ...c, status: "PENDENTE" };
      if (c.vencimento > hojeIso) return { ...c, status: "FUTURA" };

      return c;
    });

    localStorage.setItem("cobrancas", JSON.stringify(cobrancas));
  };

  // Função de Teste para o usuário verificar se Julho foi gerado
  window.verificarGeracaoMensalidades = () => {
    gerarCobrancasAutomaticas(); // Força a execução da lógica
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    const idsAtivos = alunos
      .filter((a) => a.status === "Ativo")
      .map((a) => a.id);

    const mesF =
      document.getElementById("filtroMes")?.value ||
      (new Date().getMonth() + 1).toString().padStart(2, "0");
    const anoF =
      document.getElementById("filtroAno")?.value || new Date().getFullYear();
    const competenciaAlvo = `${mesF}/${anoF}`;

    const cobrancas = JSON.parse(localStorage.getItem("cobrancas")) || [];
    // Filtra parcelas da competência selecionada para alunos ativos
    const parcelas = cobrancas.filter(
      (c) => c.competencia === competenciaAlvo && idsAtivos.includes(c.alunoId)
    );

    if (parcelas.length > 0) {
      mostrarToast(
        `Sucesso! Existem ${parcelas.length} parcelas para ${competenciaAlvo}.`,
        "success"
      );
      console.log(`Parcelas de ${competenciaAlvo}:`, parcelas);
    } else {
      alert(
        `Nenhuma parcela de ${competenciaAlvo} encontrada para os alunos ativos.`
      );
    }
  };

  const atualizarDashboard = () => {
    gerarCobrancasAutomaticas();
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    const cobrancas = JSON.parse(localStorage.getItem("cobrancas")) || [];

    const mesFiltro =
      document.getElementById("filtroMes")?.value ||
      (new Date().getMonth() + 1).toString().padStart(2, "0");
    const anoFiltro =
      document.getElementById("filtroAno")?.value || new Date().getFullYear();
    const refFiltro = `${mesFiltro}/${anoFiltro}`;

    const ativos = alunos.filter((a) => a.status === "Ativo").length;

    const recebidoNoMes = cobrancas
      .filter((c) => c.competencia === refFiltro && c.status === "PAGO")
      .reduce((acc, curr) => acc + limparMoeda(curr.valor), 0);

    const aReceberNoMes = cobrancas
      .filter(
        (c) =>
          c.competencia === refFiltro &&
          (c.status === "PENDENTE" || c.status === "FUTURA")
      )
      .reduce((acc, curr) => acc + limparMoeda(curr.valor), 0);

    const inadimplenciaTotal = cobrancas
      .filter((c) => c.status === "ATRASADO")
      .reduce((acc, curr) => acc + limparMoeda(curr.valor), 0);

    const previstoNoMes = cobrancas
      .filter((c) => c.competencia === refFiltro)
      .reduce((acc, curr) => acc + limparMoeda(curr.valor), 0);

    if (document.getElementById("totalAlunos"))
      document.getElementById("totalAlunos").innerText = alunos.length;
    if (document.getElementById("alunosAtivos"))
      document.getElementById("alunosAtivos").innerText = ativos;
    if (document.getElementById("receitaMensal"))
      document.getElementById("receitaMensal").innerText =
        formatarMoeda(recebidoNoMes);
    if (document.getElementById("totalPendenteMes"))
      document.getElementById("totalPendenteMes").innerText =
        formatarMoeda(aReceberNoMes);
    if (document.getElementById("totalInadimplentes"))
      document.getElementById("totalInadimplentes").innerText =
        formatarMoeda(inadimplenciaTotal);
    if (document.getElementById("receitaPrevista"))
      document.getElementById("receitaPrevista").innerText =
        formatarMoeda(previstoNoMes);

    if (document.getElementById("graficoPlanos")) {
      // Inicializa Gráfico Simples se o Chart.js estiver presente
      const canvas = document.getElementById("graficoPlanos");
      if (canvas && typeof Chart !== "undefined") {
        const contagemPlanos = alunos.reduce((acc, curr) => {
          acc[curr.plano] = (acc[curr.plano] || 0) + 1;
          return acc;
        }, {});

        // Se já existe um gráfico, destrói para evitar erro de "Canvas in use"
        if (chartInstance) {
          chartInstance.destroy();
        }

        chartInstance = new Chart(canvas.getContext("2d"), {
          type: "doughnut",
          data: {
            labels: Object.keys(contagemPlanos),
            datasets: [
              {
                data: Object.values(contagemPlanos),
                backgroundColor: ["#111", "#444", "#888", "#ccc"],
              },
            ],
          },
          options: { responsive: true },
        });
      }
    }
  };

  // Função para navegar do Cadastro para o Financeiro com filtro
  window.verFinanceiroAluno = (nome) => {
    window.location.href = `financeiro.html?busca=${encodeURIComponent(nome)}`;
  };

  // Função para gerar e imprimir a ficha do aluno
  window.imprimirFicha = (id) => {
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    const aluno = alunos.find((a) => a.id === id);
    if (!aluno) return;

    const win = window.open("", "PRINT", "height=600,width=800");
    win.document.write(`
            <html>
            <head>
                <title>Ficha - ${aluno.nome}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #111; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 2px solid #333; margin-bottom: 30px; padding-bottom: 10px; }
                    .header h1 { margin: 0; color: #000; text-transform: uppercase; }
                    .section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
                    .section-title { font-weight: 800; text-transform: uppercase; font-size: 14px; color: #555; border-bottom: 1px solid #eee; margin-bottom: 10px; display: block; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                    .label { font-weight: bold; color: #000; }
                    .footer { margin-top: 60px; text-align: center; }
                    .assinatura { border-top: 1px solid #000; display: inline-block; width: 300px; margin-top: 40px; padding-top: 5px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">🖨️ Confirmar Impressão / Salvar PDF</button>
                </div>
                <div class="header">
                    <h1>Ficha de Matrícula - Sou Fitness</h1>
                    <p>Documento gerado em: ${new Date().toLocaleDateString()}</p>
                </div>
                <div class="section">
                    <span class="section-title">Dados Pessoais & Contato</span>
                    <div class="grid">
                        <div><span class="label">Nome:</span> ${aluno.nome}</div>
                        <div><span class="label">CPF:</span> ${aluno.cpf || "-"}</div>
                        <div><span class="label">WhatsApp:</span> ${aluno.whatsapp || aluno.celular || "-"}</div>
                        <div><span class="label">E-mail:</span> ${aluno.email || "-"}</div>
                    </div>
                </div>
                <div class="section">
                    <span class="section-title">Plano & Contrato</span>
                    <div class="grid">
                        <div><span class="label">Plano Selecionado:</span> ${aluno.plano}</div>
                        <div><span class="label">Valor Mensal:</span> ${formatarMoeda(aluno.valor)}</div>
                        <div><span class="label">Vencimento:</span> Todo dia ${aluno.vencimento}</div>
                        <div><span class="label">Status:</span> ${aluno.status}</div>
                    </div>
                </div>
                <div class="footer">
                    <div class="assinatura">Assinatura do Aluno</div>
                </div>
            </body>
            </html>
        `);
    win.document.close();
    win.focus();
  };

  // Função para imprimir Recibo (Pagamento já realizado)
  window.imprimirRecibo = (alunoId, referencia) => {
    const pagamentos = JSON.parse(localStorage.getItem("pagamentos")) || [];
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    const p = pagamentos.find(
      (pay) => pay.alunoId === alunoId && pay.referencia === referencia
    );
    const aluno = alunos.find((a) => a.id === alunoId);

    if (!p || !aluno) return;

    const win = window.open("", "PRINT", "height=400,width=600");
    win.document.write(`
            <html>
            <head><title>Recibo - ${aluno.nome}</title></head>
            <body style="font-family: sans-serif; padding: 20px; border: 2px dashed #000;">
                <h2 style="text-align:center;">RECIBO DE PAGAMENTO</h2>
                <p><strong>Recebemos de:</strong> ${aluno.nome}</p>
                <p><strong>A quantia de:</strong> ${formatarMoeda(p.valor)}</p>
                <p><strong>Referente ao mês:</strong> ${referencia}</p>
                <p><strong>Data do pagamento:</strong> ${p.data}</p>
                <div style="margin-top:40px; text-align:center; border-top: 1px solid #000; width: 250px; margin-left: auto; margin-right: auto;">
                    Sou Fitness - Assinatura
                </div>
                <script>window.onload = function() { window.print(); window.close(); }</script>
            </body>
            </html>
        `);
    win.document.close();
  };

  // Função para imprimir Guia de Cobrança (Pagamento pendente)
  window.imprimirGuia = (alunoId, referencia) => {
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    const aluno = alunos.find((a) => a.id === alunoId);
    if (!aluno) return;

    const win = window.open("", "PRINT", "height=400,width=600");
    win.document.write(`
            <html>
            <head><title>Guia de Pagamento - ${aluno.nome}</title></head>
            <body style="font-family: sans-serif; padding: 20px; border: 1px solid #000;">
                <h2 style="text-align:center;">GUIA DE MENSALIDADE</h2>
                <p><strong>Aluno:</strong> ${aluno.nome}</p>
                <p><strong>Plano:</strong> ${aluno.plano}</p>
                <p><strong>Referência:</strong> ${referencia}</p>
                <p><strong>Valor:</strong> ${formatarMoeda(aluno.valor)}</p>
                <p><strong>Vencimento:</strong> Dia ${aluno.vencimento} de ${referencia.split("/")[0]}</p>
                <hr>
                <p style="font-size: 12px; text-align: center;">Favor realizar o pagamento na recepção da academia.</p>
                <script>window.onload = function() { window.print(); window.close(); }</script>
            </body>
            </html>
        `);
    win.document.close();
  };

  // Função para carregar dados no formulário para edição
  window.editarAluno = (id) => {
    // Se não estiver na página de Alunos, redireciona passando o ID
    if (!window.location.pathname.includes("Alunos.html")) {
      window.location.href = `Alunos.html?edit=${id}`;
      return;
    }

    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    const aluno = alunos.find((a) => a.id === id);
    if (!aluno) return;

    editId = id;
    document.getElementById("nome").value = aluno.nome;
    document.getElementById("cpf").value = aluno.cpf || "";
    document.getElementById("nascimento").value = aluno.nascimento || "";
    document.getElementById("sexo").value = aluno.sexo || "Masculino";
    document.getElementById("estadoCivil").value =
      aluno.estadoCivil || "Solteiro";
    document.getElementById("celular").value = aluno.celular || "";
    document.getElementById("whatsapp").value = aluno.whatsapp || "";
    document.getElementById("email").value = aluno.email || "";
    document.getElementById("plano").value = aluno.plano;
    document.getElementById("valor").value = formatarMoeda(aluno.valor);
    document.getElementById("vencimento").value = aluno.vencimento || "";
    document.getElementById("status").checked = aluno.status === "Ativo";
    document.getElementById("peso").value = aluno.peso || "";
    document.getElementById("altura").value = aluno.altura || "";
    calcularIMC();

    const btn = form.querySelector(".btn-salvar");
    btn.innerText = "Atualizar Aluno";
    btn.style.background = "#22C55E";
    btn.style.color = "white";

    const btnImp = document.getElementById("btnImprimirFicha");
    if (btnImp) {
      btnImp.style.display = "block";
      btnImp.onclick = () => window.imprimirFicha(id);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Função para carregar os dados na tabela do Financeiro
  const carregarFinanceiro = () => {
    if (window.location.pathname.includes("financeiro.html")) {
      const tabHoje = document.getElementById("tabelaHoje");
      if (tabHoje) {
        carregarAlunos(); // Carrega a listagem geral e as segmentadas
      }
    }
  };

  // --- FUNÇÃO DE EXTRATO FINANCEIRO INDIVIDUAL ---
  window.exibirExtratoAluno = (id, editCobId = null) => {
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    const cobrancas = JSON.parse(localStorage.getItem("cobrancas")) || [];
    const aluno = alunos.find((a) => a.id === id);
    if (!aluno) return;

    const extratoModal = document.getElementById("modalExtrato");
    const tabelaCorpo = document.getElementById("extratoTabelaCorpo");

    if (!extratoModal || !tabelaCorpo) {
      console.error("Estrutura do modal não encontrada nesta página.");
      return;
    }

    const filtroAno =
      document.getElementById("filtroAno")?.value || new Date().getFullYear();

    let tituloExtrato = `Ficha Financeira: ${aluno.nome}`;
    if (aluno.status === "Inativo" && aluno.dataCancelamento) {
      tituloExtrato += `<br><span style="color: #EF4444; font-size: 13px; font-weight: 500;">🚫 Plano Cancelado em: ${aluno.dataCancelamento}</span>`;
    }

    document.getElementById("extratoNomeAluno").innerHTML = tituloExtrato;
    tabelaCorpo.innerHTML = "";

    // --- FILTRO DE EXIBIÇÃO DO HISTÓRICO ---
    const hoje = new Date();
    const mesAtualNum = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    // Chave do mês atual ex: "052025"
    const chaveMesAtual = `${mesAtualNum.toString().padStart(2, "0")}${anoAtual}`;

    // Helper para converter competência "MM/AAAA" em chave comparável "MMAAAA"
    const chaveComp = (comp) => {
      const [m, a] = comp.split("/");
      return `${m}${a}`;
    };

    // Filtra cobranças do aluno:
    // - Para ATIVO: esconde meses PAGO cujo vencimento já passou (antes do mês atual)
    //   Mantém: meses com pendência/atraso, o mês atual (pago ou não), e meses futuros
    // - Para INATIVO: mostra apenas até o mês em que o plano foi cancelado
    let historico = cobrancas
      .filter((c) => {
        if (c.alunoId !== id) return false;
        const chave = chaveComp(c.competencia);

        if (aluno.status === "Inativo") {
          // Determina o mês de cancelamento
          let mesCancelamento = chaveMesAtual;
          if (aluno.dataCancelamento) {
            const partes = aluno.dataCancelamento.split("/");
            if (partes.length === 3) {
              // dataCancelamento em dd/MM/yyyy
              mesCancelamento = `${partes[1]}${partes[2]}`;
            }
          }
          // Mostra apenas meses até o cancelamento (inclusive) que não sejam FUTURA limpa
          // Mantém PAGO sempre, e ATRASADO/PENDENTE até o mês do cancelamento
          if (c.status === "PAGO") return true;
          if (chave > mesCancelamento) return false;
          return true;
        } else {
          // ATIVO: esconde meses PAGO que já passaram (antes do mês atual)
          if (c.status === "PAGO" && chave < chaveMesAtual) return false;
          return true;
        }
      })
      .sort(
        (a, b) =>
          chaveComp(b.competencia) - chaveComp(a.competencia)
      ); // Ordena decrescente

    let totalPago = 0,
      totalPendente = 0,
      totalAtrasado = 0;

    historico.forEach((c) => {
      const valorNum = limparMoeda(c.valor);
      if (c.status === "PAGO") totalPago += valorNum;
      else if (c.status === "ATRASADO") totalAtrasado += valorNum;
      else totalPendente += valorNum;

      const statusClass = c.status.toLowerCase();
      const emEdicao = String(c.id) === String(editCobId);

      let campoPagamento = c.dataPagamento || "-";

      // Se não estiver pago OU se o usuário clicou para editar a data
      if (c.status !== "PAGO" || emEdicao) {
        // Verifica se já existe outra cobrança PAGA com a mesma competência (duplicata)
        const jaExistePagoOutro = cobrancas.some(
          (x) =>
            x.alunoId === id &&
            x.competencia === c.competencia &&
            x.status === "PAGO" &&
            String(x.id) !== String(c.id)
        );

        if (jaExistePagoOutro) {
          // Esta cobrança é duplicata de uma já paga — exibe apenas aviso
          campoPagamento = `<span style="color: #F59E0B; font-size: 12px;">⚠️ Já existe pagamento registrado nesta competência</span>`;
        } else {
          let dataSugerida = new Date().toISOString().split("T")[0];
          if (emEdicao && c.dataPagamento) {
            const partes = c.dataPagamento.split("/");
            if (partes.length === 3)
              dataSugerida = `${partes[2]}-${partes[1]}-${partes[0]}`;
          }

          campoPagamento = `
                      <div style="display: flex; gap: 5px; align-items: center;" class="no-print">
                          <button onclick="gerarPix('${id}', '${c.valor}')" class="badge-pagamento pendente" style="background:#7c3aed; padding: 2px 8px; min-width: auto; height: 24px; font-size: 10px;" title="Gerar QR Code PIX">PIX</button>
                          <button onclick="enviarWhatsAppPix('${id}', '${c.valor}', '${c.competencia}')" class="badge-pagamento pago" style="background:#22c55e; padding: 2px 8px; min-width: auto; height: 24px; font-size: 10px;" title="Enviar PIX por WhatsApp">📱</button>
                          <input type="date" id="data_ext_${c.id}" value="${dataSugerida}" style="padding: 4px; font-size: 12px; width: 125px; background: #0f172a; border: 1px solid var(--border); color: white; border-radius: 6px; cursor: pointer;">
                          <button onclick="receberPagamentoExtrato('${id}', '${c.id}', '${c.competencia}')" class="badge-pagamento pago" style="padding: 2px 8px; min-width: auto; height: 24px; font-size: 10px;">${emEdicao ? "Atualizar" : "Confirmar"}</button>
                      </div>
                  `;
        }
      } else {
        // PAGO — destaque em verde e opção de editar data
        campoPagamento = `
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span style="font-weight: bold; color: var(--success);">✅ ${c.dataPagamento}</span>
                        <button onclick="exibirExtratoAluno('${id}', '${c.id}')" title="Editar Data de Pagamento" class="no-print" style="background:none; border:none; cursor:pointer; font-size: 12px; padding: 0;">✏️</button>
                    </div>
                `;
      }

      const row = tabelaCorpo.insertRow();
      // Linha verde de fundo para mês pago
      if (c.status === "PAGO") {
        row.style.background = "rgba(34,197,94,0.08)";
        row.style.borderLeft = "3px solid var(--success)";
      }
      row.innerHTML = `
                <td><strong style="${c.status === "PAGO" ? "color: var(--success);" : ""}">${c.competencia}</strong></td>
                <td>${c.vencimento.split("-").reverse().join("/")}</td>
                <td>${formatarMoeda(c.valor)}</td>
                <td><span class="badge-pagamento ${statusClass}">${c.status}</span></td>
                <td>${campoPagamento}</td>
            `;
    });

    document.getElementById("extratoPago").innerText = formatarMoeda(totalPago);
    document.getElementById("extratoAtrasado").innerText =
      formatarMoeda(totalAtrasado);

    extratoModal.style.display = "block";
  };

  window.receberPagamentoExtrato = (alunoId, cobrancaId, competencia) => {
    const inputEl = document.getElementById(`data_ext_${cobrancaId}`);
    if (!inputEl || !inputEl.value) {
      alert("Por favor, selecione a data do pagamento.");
      return;
    }
    const dataInput = inputEl.value;

    const [ano, mes, dia] = dataInput.split("-");
    const dataFormatada = `${dia}/${mes}/${ano}`;

    let cobrancas = JSON.parse(localStorage.getItem("cobrancas")) || [];
    const idx = cobrancas.findIndex((c) => String(c.id) === String(cobrancaId));

    if (idx !== -1) {
      const cob = cobrancas[idx];

      // PROTEÇÃO CONTRA PAGAMENTO DUPLO: verifica se já existe outra cobrança PAGA
      // com a mesma competência para o mesmo aluno (diferente do id em edição)
      const jaExistePago = cobrancas.some(
        (c) =>
          c.alunoId === cob.alunoId &&
          c.competencia === competencia &&
          c.status === "PAGO" &&
          String(c.id) !== String(cobrancaId)
      );
      if (jaExistePago) {
        mostrarToast(`⚠️ A competência ${competencia} já foi paga para este aluno!`, "error");
        return;
      }

      cob.status = "PAGO";
      cob.dataPagamento = dataFormatada;
      localStorage.setItem("cobrancas", JSON.stringify(cobrancas));

      // Registrar no histórico de pagamentos para consistência dos relatórios
      let pagamentos = JSON.parse(localStorage.getItem("pagamentos")) || [];
      const pIdx = pagamentos.findIndex(
        (p) => p.alunoId === alunoId && p.referencia === competencia
      );

      if (pIdx !== -1) {
        // Se já existe, apenas atualiza a data (Edição)
        pagamentos[pIdx].data = dataFormatada;
        pagamentos[pIdx].valor = limparMoeda(cob.valor);
      } else {
        pagamentos.push({
          id: Date.now(),
          alunoId: alunoId,
          nome: cob.nome,
          valor: limparMoeda(cob.valor),
          data: dataFormatada,
          referencia: competencia,
        });
      }
      localStorage.setItem("pagamentos", JSON.stringify(pagamentos));

      mostrarToast("✅ Pagamento registrado com sucesso!");
      exibirExtratoAluno(alunoId); // Atualiza o modal do extrato
      carregarAlunos(); // Atualiza as tabelas de fundo no financeiro
      atualizarDashboard();

      // Abre o recibo com um pequeno delay para que a UI atualize primeiro
      setTimeout(() => window.imprimirRecibo(alunoId, competencia), 300);
    }
  };

  // Carregar alunos salvos ao iniciar
  const carregarAlunos = () => {
    const alunos = JSON.parse(localStorage.getItem("alunos")) || [];

    // Verifica se há filtros na URL (ex: ?filtro=Ativo&pagamento=atraso)
    const urlParams = new URLSearchParams(window.location.search);
    let filtroStatus = urlParams.get("filtro");
    const filtroPagamento = urlParams.get("pagamento");
    const termoBusca = normalizarTexto(
      document.getElementById("buscaNome")?.value || ""
    );
    const pagamentos = JSON.parse(localStorage.getItem("pagamentos")) || [];

    const mesFiltro =
      document.getElementById("filtroMes")?.value ||
      (new Date().getMonth() + 1).toString().padStart(2, "0");
    const anoFiltro =
      document.getElementById("filtroAno")?.value || new Date().getFullYear();
    const refFiltro = `${mesFiltro}/${anoFiltro}`;

    // No financeiro, por padrão, filtramos para mostrar apenas alunos Ativos
    if (
      window.location.pathname.includes("financeiro.html") &&
      !filtroStatus &&
      !termoBusca
    ) {
      filtroStatus = "Ativo";
    }

    if (tabelaAlunos) {
      tabelaAlunos.innerHTML = "";

      // Se estivermos no financeiro, populamos as tabelas baseadas nas cobranças, não apenas nos alunos
      const tabHoje = document.getElementById("tabelaHoje");
      const tabAtraso = document.getElementById("tabelaAtraso");
      const tabProximos = document.getElementById("tabelaProximos");
      const cobrancas = JSON.parse(localStorage.getItem("cobrancas")) || [];
      const hojeIso = new Date().toISOString().split("T")[0];

      if (tabHoje) {
        tabHoje.innerHTML = tabAtraso.innerHTML = tabProximos.innerHTML = "";

        cobrancas.forEach((cob) => {
          const aluno = alunos.find((a) => a.id === cob.alunoId);
          if (
            !aluno ||
            (termoBusca && !normalizarTexto(aluno.nome).includes(termoBusca))
          )
            return;
          if (filtroStatus && aluno.status !== filtroStatus) return;

          if (cob.status === "ATRASADO") {
            adicionarLinhaTabelaSegmentada(tabAtraso, aluno, cob);
          } else if (cob.status === "PENDENTE" && cob.vencimento === hojeIso) {
            adicionarLinhaTabelaSegmentada(tabHoje, aluno, cob);
          } else if (cob.status === "FUTURA" && cob.competencia === refFiltro) {
            adicionarLinhaTabelaSegmentada(tabProximos, aluno, cob);
          }
        });
      }

      let alunosParaExibir = alunos;
      if (termoBusca) {
        alunosParaExibir = alunosParaExibir.filter((a) =>
          normalizarTexto(a.nome).includes(termoBusca)
        );
      }
      if (filtroStatus) {
        alunosParaExibir = alunosParaExibir.filter(
          (a) => a.status === filtroStatus
        );
      }
      if (filtroPagamento) {
        const diaHoje = new Date().getDate();
        alunosParaExibir = alunosParaExibir.filter((a) => {
          const pago = pagamentos.some(
            (p) => p.alunoId === a.id && p.referencia === refFiltro
          );
          return filtroPagamento === "atraso"
            ? !pago && diaHoje > (parseInt(a.vencimento) || 31)
            : pago || diaHoje <= (parseInt(a.vencimento) || 31);
        });
      }

      // Verifica se veio de um redirecionamento de edição
      const idParaEditar = urlParams.get("edit");
      if (idParaEditar && !editId) {
        // Pequeno delay para garantir que o formulário está pronto
        setTimeout(() => window.editarAluno(idParaEditar), 100);
      }

      // Preenche a tabela de inadimplência histórica se ela existir na página
      const tabelaInadimplentes = document.getElementById(
        "tabelaInadimplentes"
      );
      if (tabelaInadimplentes) {
        tabelaInadimplentes.innerHTML = "";
        alunos.forEach((aluno) => {
          const hist = calcularPendenciasHistoricas(aluno);
          if (hist.meses.length > 0) adicionarLinhaInadimplente(aluno, hist);
        });
      }
      alunosParaExibir.forEach((aluno) => adicionarLinhaTabela(aluno));
    }
  };

  // Função para adicionar linha na tabela com estilo por status
  const adicionarLinhaTabela = (aluno) => {
    if (!tabelaAlunos) return;
    const pagamentos = JSON.parse(localStorage.getItem("pagamentos")) || [];

    const mesFiltro =
      document.getElementById("filtroMes")?.value ||
      (new Date().getMonth() + 1).toString().padStart(2, "0");
    const anoFiltro =
      document.getElementById("filtroAno")?.value || new Date().getFullYear();
    const refFiltro = `${mesFiltro}/${anoFiltro}`;

    const pagoEsteMes = pagamentos.some(
      (p) => p.alunoId === aluno.id && p.referencia === refFiltro
    );

    const novaLinha = tabelaAlunos.insertRow();
    const statusClass = (aluno.status || "Ativo").toLowerCase();
    const isManagementPage =
      window.location.pathname.includes("alunosativos.html") ||
      window.location.pathname.includes("financeiro.html");

    let colStatus = `
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label class="switch">
                        <input type="checkbox" onchange="atualizarStatus('${aluno.id}', this.checked ? 'Ativo' : 'Inativo')" ${aluno.status === "Ativo" ? "checked" : ""}>
                        <span class="slider-toggle"></span>
                    </label>
                    <span style="font-size: 13px; font-weight: 500; color: ${aluno.status === "Ativo" ? "var(--success)" : "#EF4444"}">
                        ${aluno.status || "Ativo"}
                    </span>
                </div>
            </td>
        `;
    let colExtra = "";

    if (isManagementPage) {
      const venc = aluno.vencimento || "-";
      const diaHoje = new Date().getDate();
      const vencNum = parseInt(aluno.vencimento) || 31;
      const atrasado = !pagoEsteMes && diaHoje > vencNum;
      const pagStatusText = pagoEsteMes
        ? "Pago"
        : atrasado
          ? "Atrasado"
          : "Pendente";
      const pagClass = pagoEsteMes
        ? "pago"
        : atrasado
          ? "atrasado"
          : "pendente";

      colStatus = `
                <td>
                    <select onchange="atualizarStatus('${aluno.id}', this.value)" class="status-select">
                        <option value="Ativo" ${aluno.status === "Ativo" ? "selected" : ""}>Ativo</option>
                        <option value="Inativo" ${aluno.status === "Inativo" ? "selected" : ""}>Inativo</option>
                        <option value="Inadimplente" ${aluno.status === "Inadimplente" ? "selected" : ""}>Inadimplente</option>
                        <option value="Bloqueado" ${aluno.status === "Bloqueado" ? "selected" : ""}>Bloqueado</option>
                    </select>
                </td>
            `;

      if (window.location.pathname.includes("financeiro.html")) {
        if (pagoEsteMes) {
          const p = pagamentos.find(
            (pay) => pay.alunoId === aluno.id && pay.referencia === refFiltro
          );
          colExtra = `
                        <td>Dia ${venc}</td>
                        ${colStatus}
                        <td>
                            <div style="font-size: 12px; color: var(--success); font-weight: bold; margin-bottom: 5px;">
                                ${p.data} - ${formatarMoeda(p.valor)}
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button onclick="imprimirRecibo('${aluno.id}', '${refFiltro}')" class="badge-pagamento pago" style="flex:1;">📄 Recibo</button>
                                <button onclick="togglePagamento('${aluno.id}')" class="badge-pagamento atrasado" style="flex:1;">🔄 Estornar</button>
                            </div>
                        </td>
                    `;
        } else {
          const hojeReal = new Date();
          const isMesAtual =
            mesFiltro ==
              (hojeReal.getMonth() + 1).toString().padStart(2, "0") &&
            anoFiltro == hojeReal.getFullYear();
          const dataSugerida = isMesAtual
            ? hojeReal.toISOString().split("T")[0]
            : `${anoFiltro}-${mesFiltro}-01`;

          colExtra = `
                        <td>Dia ${venc}</td>
                        ${colStatus}
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 5px;">
                                <input type="date" id="data_${aluno.id}" value="${dataSugerida}" style="padding: 5px; font-size: 12px; height: 30px; width: 100%;">
                                <input type="text" id="val_${aluno.id}" value="${formatarMoeda(aluno.valor)}" style="padding: 5px; font-size: 12px; height: 30px; width: 100%;">
                                <div style="display: flex; gap: 5px;">
                                    <button onclick="gerarPix('${aluno.id}', '${aluno.valor}')" class="badge-pagamento pendente" style="background:#7c3aed; flex:1;">PIX</button>
                                    <button onclick="enviarWhatsAppPix('${aluno.id}', '${aluno.valor}', '${refFiltro}')" class="badge-pagamento pago" style="background:#22c55e; min-width:35px;" title="Enviar pelo WhatsApp">📱</button>
                                    <button onclick="confirmarPagamento('${aluno.id}')" class="badge-pagamento pago" style="flex:1;">✅ Pagar</button>
                                    <button onclick="imprimirGuia('${aluno.id}', '${refFiltro}')" class="badge-pagamento pendente" style="flex:1;">🖨️ Guia</button>
                                </div>
                            </div>
                        </td>
                    `;
        }
      } else {
        colExtra = `
                    <td>Dia ${venc}</td>
                    ${colStatus}
                    <td>
                        <button onclick="togglePagamento('${aluno.id}')" class="badge-pagamento ${pagClass}">
                            ${pagStatusText}
                        </button>
                    </td>
                `;
      }
    } else {
      colExtra = colStatus;
    }

    novaLinha.innerHTML = `
            <td>${aluno.nome}</td>
            <td>${new Date(parseInt(aluno.id)).toLocaleDateString("pt-BR")}</td>
            <td>${aluno.plano}</td>
            <td>${formatarMoeda(aluno.valor)}</td>
            ${colExtra}
            <td>
                <button onclick="exibirExtratoAluno('${aluno.id}')" title="Histórico Financeiro" style="background:none; border:none; cursor:pointer; color:#7c3aed; margin-right: 8px;">📜</button>
                <button onclick="verFinanceiroAluno('${aluno.nome}')" title="Filtrar no Financeiro" style="background:none; border:none; cursor:pointer; color:#22C55E; margin-right: 8px;">💰</button>
                <button onclick="editarAluno('${aluno.id}')" style="background:none; border:none; cursor:pointer; color:var(--primary); margin-right: 8px;">✏️</button>
                <button onclick="imprimirFicha('${aluno.id}')" title="Imprimir Ficha" style="background:none; border:none; cursor:pointer; color:#3b82f6; margin-right: 8px;">🖨️</button>
                <button onclick="removerAluno('${aluno.id}')" style="background:none; border:none; cursor:pointer; color:#ff4444;">🗑️</button>
            </td>
        `;
  };

  // Adiciona linha na tabela de débitos acumulados (Dívida Histórica)
  const adicionarLinhaInadimplente = (aluno, hist) => {
    const tabela = document.getElementById("tabelaInadimplentes");
    if (!tabela) return;
    const row = tabela.insertRow();
    row.innerHTML = `
            <td><strong>${aluno.nome}</strong></td>
            <td style="color: #EF4444; font-weight: bold;">${hist.meses.length} mês(es)</td>
            <td><small>${hist.meses.join(", ")}</small></td>
            <td style="font-weight: bold; color: #EF4444;">${formatarMoeda(hist.total)}</td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button onclick="exibirExtratoAluno('${aluno.id}')" title="Histórico Financeiro" style="background:none; border:none; cursor:pointer; color:#7c3aed;">📜</button>
                    <button onclick="verFinanceiroAluno('${aluno.nome}')" class="badge-pagamento atrasado" style="width:100%">Ir para Acerto</button>
                </div>
            </td>
        `;
  };

  // Função auxiliar para preencher as tabelas segmentadas do financeiro
  const adicionarLinhaTabelaSegmentada = (tabela, aluno, cobranca) => {
    const row = tabela.insertRow();
    const dataSugerida = new Date().toISOString().split("T")[0];

    const statusColor =
      cobranca.status === "ATRASADO"
        ? "#EF4444"
        : cobranca.status === "PENDENTE"
          ? "#F59E0B"
          : "#64748b";
    const vencFormatado = cobranca.vencimento.split("-").reverse().join("/");

    row.innerHTML = `
            <td><strong>${aluno.nome}</strong></td>
            <td>${aluno.plano}</td>
            <td>${formatarMoeda(cobranca.valor)}</td>
            <td><span style="color: ${statusColor}; font-weight: bold;">${cobranca.competencia}</span> (Venc. ${vencFormatado})</td>
            <td>
                <div style="display: flex; gap: 5px; align-items: center;" class="no-print">
                    <button onclick="exibirExtratoAluno('${aluno.id}')" title="Histórico Financeiro" style="background:none; border:none; cursor:pointer; color:#7c3aed; margin-right: 5px;">📜</button>
                    <input type="date" id="data_cob_${cobranca.id}" value="${dataSugerida}" style="padding: 4px; font-size: 12px; width: 125px; background: #0f172a; border: 1px solid var(--border); color: white; cursor: pointer; border-radius: 6px;">
                    <button onclick="confirmarPagamentoCobranca('${cobranca.id}')" class="badge-pagamento pago">✅ Receber</button>
                </div>
            </td>
        `;
  };

  window.confirmarPagamentoCobranca = (cobrancaId) => {
    const inputData = document.getElementById(`data_cob_${cobrancaId}`);
    if (!inputData || !inputData.value) {
      alert("Por favor, selecione a data do recebimento.");
      return;
    }

    const dataInput = inputData.value;
    const [ano, mes, dia] = dataInput.split("-");
    const dataFormatada = `${dia}/${mes}/${ano}`;

    let cobrancas = JSON.parse(localStorage.getItem("cobrancas")) || [];
    const idx = cobrancas.findIndex((c) => String(c.id) === String(cobrancaId));

    if (idx !== -1) {
      const cob = cobrancas[idx];

      // ✅ PROTEÇÃO CONTRA PAGAMENTO DUPLO
      // Verifica tanto o status direto quanto duplicatas cruzadas
      if (cob.status === "PAGO") {
        mostrarToast(`⚠️ ${cob.competencia} já está registrado como pago!`, "error");
        return;
      }
      const jaExistePago = cobrancas.some(
        (c) =>
          c.alunoId === cob.alunoId &&
          c.competencia === cob.competencia &&
          c.status === "PAGO" &&
          String(c.id) !== String(cobrancaId)
      );
      if (jaExistePago) {
        mostrarToast(`⚠️ Já existe pagamento de ${cob.competencia} para este aluno!`, "error");
        return;
      }

      cob.status = "PAGO";
      cob.dataPagamento = dataFormatada;

      // Registra no histórico de pagamentos (upsert: atualiza se já existir)
      let pagamentos = JSON.parse(localStorage.getItem("pagamentos")) || [];
      const pIdx = pagamentos.findIndex(
        (p) => p.alunoId === cob.alunoId && p.referencia === cob.competencia
      );
      if (pIdx !== -1) {
        pagamentos[pIdx].data = dataFormatada;
        pagamentos[pIdx].valor = limparMoeda(cob.valor);
      } else {
        pagamentos.push({
          id: Date.now(),
          alunoId: cob.alunoId,
          nome: cob.nome,
          valor: limparMoeda(cob.valor),
          data: dataFormatada,
          referencia: cob.competencia,
        });
      }

      localStorage.setItem("pagamentos", JSON.stringify(pagamentos));
      localStorage.setItem("cobrancas", JSON.stringify(cobrancas));

      mostrarToast("✅ Pagamento de " + cob.competencia + " recebido!");
      carregarAlunos();
      atualizarDashboard();

      // Abre o recibo com um pequeno delay para que a UI atualize primeiro
      setTimeout(
        () => window.imprimirRecibo(cob.alunoId, cob.competencia),
        300
      );
    }
  };

  // Remova a função antiga redundante
  window.confirmarPagamento = (id) => {
    // Esta função agora é substituída por confirmarPagamentoCobranca
    // Mas mantemos o redirecionamento caso necessário
    console.warn("Use confirmarPagamentoCobranca para maior precisão.");
  };

  // Função para calcular o IMC automaticamente
  const calcularIMC = () => {
    if (!pesoInput || !alturaInput) return;
    // Converte valores tratando vírgulas como pontos
    const peso = parseFloat(pesoInput.value.toString().replace(",", "."));
    let altura = parseFloat(alturaInput.value.toString().replace(",", "."));

    if (peso > 0 && altura > 0) {
      // Caso o usuário digite a altura em centímetros (ex: 170 em vez de 1.70)
      if (altura > 3) altura = altura / 100;

      const imc = (peso / (altura * altura)).toFixed(2);
      let classe = "";
      if (imc < 18.5) classe = "Abaixo do peso";
      else if (imc < 25) classe = "Peso Normal";
      else if (imc < 30) classe = "Sobrepeso";
      else if (imc < 35) classe = "Obesidade Grau I";
      else if (imc < 40) classe = "Obesidade Grau II";
      else classe = "Obesidade Grau III";

      imcInput.value = `${imc} - ${classe}`;
    } else {
      imcInput.value = "";
    }
  };

  if (pesoInput) pesoInput.addEventListener("input", calcularIMC);
  if (alturaInput) alturaInput.addEventListener("input", calcularIMC);

  // Função para salvar o aluno e adicionar na tabela
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const valorLimpo = limparMoeda(document.getElementById("valor").value);

      const dadosAluno = {
        nome: document.getElementById("nome").value,
        cpf: document.getElementById("cpf").value,
        nascimento: document.getElementById("nascimento").value,
        sexo: document.getElementById("sexo").value,
        estadoCivil: document.getElementById("estadoCivil").value,
        celular: document.getElementById("celular").value,
        whatsapp: document.getElementById("whatsapp").value,
        email: document.getElementById("email").value,
        plano: document.getElementById("plano").value,
        valor: valorLimpo,
        status: document.getElementById("status").checked ? "Ativo" : "Inativo",
        vencimento: document.getElementById("vencimento").value,
        peso: pesoInput.value,
        altura: alturaInput.value,
        imc: imcInput.value,
      };

      // Salvar no localStorage
      let alunos = JSON.parse(localStorage.getItem("alunos")) || [];

      // Validação profissional: Verificar se o CPF já existe (apenas em novos cadastros)
      const cpfExiste = alunos.some(
        (a) => a.cpf === dadosAluno.cpf && a.id !== editId
      );
      if (cpfExiste && dadosAluno.cpf) {
        mostrarToast("Erro: Este CPF já está cadastrado!", "error");
        return;
      }

      const isEdit = !!editId;
      if (editId) {
        const index = alunos.findIndex((a) => a.id === editId);
        if (index !== -1) {
          // Mantém o ID e o status de pagamento original na atualização
          alunos[index] = { ...alunos[index], ...dadosAluno };
        }
        editId = null;
        const btn = form.querySelector(".btn-salvar");
        btn.innerText = "Salvar Aluno";
        btn.style.background = "var(--primary)";
        btn.style.color = "black";

        const btnImp = document.getElementById("btnImprimirFicha");
        if (btnImp) {
          btnImp.style.display = "none";
        }

        // Limpa o parâmetro da URL se existir
        if (window.location.search.includes("edit=")) {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }
      } else {
        const novoAluno = {
          ...dadosAluno,
          id: Date.now().toString(),
        };
        alunos.push(novoAluno);
      }

      localStorage.setItem("alunos", JSON.stringify(alunos));

      carregarAlunos();
      atualizarDashboard();

      form.reset();
      imcInput.value = "";

      mostrarToast(
        isEdit
          ? "Cadastro atualizado com sucesso!"
          : "Cadastro realizado com sucesso!"
      );
    });
  }

  window.atualizarStatus = (id, novoStatus) => {
    let alunos = JSON.parse(localStorage.getItem("alunos")) || [];
    alunos = alunos.map((a) => {
      if (a.id === id) {
        let dataCancelamento = a.dataCancelamento || null;
        if (novoStatus === "Inativo" && a.status !== "Inativo") {
          // Grava a data apenas se ele estiver sendo inativado agora
          dataCancelamento = new Date().toLocaleDateString("pt-BR");
        } else if (novoStatus === "Ativo") {
          // Limpa a data de cancelamento ao reativar
          dataCancelamento = null;
        }
        return { ...a, status: novoStatus, dataCancelamento };
      }
      return a;
    });
    localStorage.setItem("alunos", JSON.stringify(alunos));
    carregarAlunos();
    atualizarDashboard();
  };

  window.togglePagamento = (id) => {
    let pagamentos = JSON.parse(localStorage.getItem("pagamentos")) || [];
    const refAtual = new Date().toLocaleDateString("pt-BR", {
      month: "2-digit",
      year: "numeric",
    });
    const indexExistente = pagamentos.findIndex(
      (p) => p.alunoId === id && p.referencia === refAtual
    );

    if (indexExistente !== -1) {
      // Se já pagou este mês, remove o pagamento (estorno)
      pagamentos.splice(indexExistente, 1);
    } else {
      // Se não pagou, cria o lançamento
      const alunos = JSON.parse(localStorage.getItem("alunos")) || [];
      const aluno = alunos.find((a) => a.id === id);

      pagamentos.push({
        id: Date.now(),
        alunoId: id,
        nome: aluno.nome,
        valor: aluno.valor,
        data: new Date().toLocaleDateString("pt-BR"),
        referencia: refAtual,
      });
    }

    localStorage.setItem("pagamentos", JSON.stringify(pagamentos));
    carregarAlunos();
    atualizarDashboard();
    carregarFinanceiro();
  };

  window.removerPagamento = (id) => {
    if (confirm("Deseja excluir este registro de pagamento do histórico?")) {
      let pagamentos = JSON.parse(localStorage.getItem("pagamentos")) || [];
      pagamentos = pagamentos.filter((p) => p.id !== id);
      localStorage.setItem("pagamentos", JSON.stringify(pagamentos));
      carregarFinanceiro();
      atualizarDashboard();
    }
  };

  // Função global para remover aluno (chamada pelo botão na tabela)
  window.removerAluno = (id) => {
    const noFinanceiro = window.location.pathname.includes("financeiro.html");

    if (noFinanceiro) {
      if (
        confirm(
          "Deseja retirar este aluno do financeiro? Isso irá inativar o cadastro, mas manterá o histórico e os dados salvos."
        )
      ) {
        window.atualizarStatus(id, "Inativo");
        mostrarToast("Aluno inativado e removido do fluxo financeiro.");
      }
    } else {
      // No cadastro geral, ainda permitimos a exclusão total se o usuário desejar
      const opcao = confirm(
        "Deseja apagar definitivamente os dados deste aluno? \n\nClique em OK para APAGAR TUDO ou CANCELAR para apenas INATIVAR."
      );
      if (opcao) {
        let alunos = JSON.parse(localStorage.getItem("alunos")) || [];
        alunos = alunos.filter((aluno) => aluno.id !== id);
        localStorage.setItem("alunos", JSON.stringify(alunos));
        mostrarToast("Aluno removido permanentemente.");
        carregarAlunos();
        atualizarDashboard();
      }
    }
  };

  // --- SISTEMA DE BACKUP E RESTAURAÇÃO (SEGURANÇA PROFISSIONAL) ---
  window.exportarDados = () => {
    const dados = {
      alunos: JSON.parse(localStorage.getItem("alunos")) || [],
      cobrancas: JSON.parse(localStorage.getItem("cobrancas")) || [],
      pagamentos: JSON.parse(localStorage.getItem("pagamentos")) || [],
      config_pix: JSON.parse(localStorage.getItem("config_pix")) || {},
      planos: JSON.parse(localStorage.getItem("planos")) || [],
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", url);
    downloadAnchorNode.setAttribute(
      "download",
      `backup_academia_${new Date().toLocaleDateString().replace(/\//g, "-")}.json`
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
    mostrarToast(`Backup de ${dados.alunos.length} alunos gerado com sucesso!`);
  };

  window.importarDados = (input) => {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dados = JSON.parse(e.target.result);
        if (dados.alunos)
          localStorage.setItem("alunos", JSON.stringify(dados.alunos));
        if (dados.cobrancas)
          localStorage.setItem("cobrancas", JSON.stringify(dados.cobrancas));
        if (dados.pagamentos)
          localStorage.setItem("pagamentos", JSON.stringify(dados.pagamentos));
        if (dados.config_pix)
          localStorage.setItem("config_pix", JSON.stringify(dados.config_pix));
        if (dados.planos)
          localStorage.setItem("planos", JSON.stringify(dados.planos));
        mostrarToast("Dados restaurados com sucesso!");
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        mostrarToast("Erro ao ler arquivo de backup.", "error");
      }
    };
    reader.readAsText(file);
  };

  const buscaNome = document.getElementById("buscaNome");
  if (buscaNome) {
    buscaNome.addEventListener("input", carregarAlunos);
  }

  // Inicializar filtros de data
  const filtroMes = document.getElementById("filtroMes");
  const filtroAno = document.getElementById("filtroAno");
  if (filtroMes)
    filtroMes.value = (new Date().getMonth() + 1).toString().padStart(2, "0");
  if (filtroAno) filtroAno.value = new Date().getFullYear();

  if (filtroMes)
    filtroMes.addEventListener("change", () => {
      carregarAlunos();
      atualizarDashboard();
    });
  if (filtroAno)
    filtroAno.addEventListener("change", () => {
      carregarAlunos();
      atualizarDashboard();
    });

  // Inicialização ao carregar a página
  window.inicializarPlanos();
  carregarAlunos();
  atualizarDashboard();
});
