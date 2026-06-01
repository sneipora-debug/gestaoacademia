const form = document.getElementById("formAluno");
const tabela = document.getElementById("tabelaAlunos");

const peso = document.getElementById("peso");
const altura = document.getElementById("altura");
const imc = document.getElementById("imc");

let alunos = [];

function calcularIMC() {
  if (peso.value && altura.value) {
    let resultado = peso.value / (altura.value * altura.value);

    imc.value = resultado.toFixed(2);
  }
}

peso.addEventListener("input", calcularIMC);
altura.addEventListener("input", calcularIMC);

form.addEventListener("submit", function (e) {
  e.preventDefault();

  const aluno = {
    nome: document.getElementById("nome").value,
    plano: document.getElementById("plano").value,
    valor: document.getElementById("valor").value,
    status: document.getElementById("status").value,
  };

  alunos.push(aluno);

  atualizarTabela();

  form.reset();

  imc.value = "";
});

function atualizarTabela() {
  tabela.innerHTML = "";

  alunos.forEach((aluno) => {
    tabela.innerHTML += `
            <tr>
                <td>${aluno.nome}</td>
                <td>${aluno.plano}</td>
                <td>R$ ${aluno.valor}</td>
                <td>${aluno.status}</td>
            </tr>
        `;
  });
}
