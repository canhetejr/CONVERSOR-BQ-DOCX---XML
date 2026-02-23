/**
 * Conversor BQ DOCX → XML (Moodle)
 * Versão JavaScript para execução no navegador.
 * Equivalente ao main.py + models.py em Python.
 */

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Extrai os parágrafos de um arquivo .docx (ArrayBuffer).
 * O .docx é um ZIP contendo word/document.xml.
 */
async function readDocx(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXml, 'text/xml');
  const paragraphs = [];
  const pNodes = doc.getElementsByTagNameNS(WORD_NS, 'p');
  for (let i = 0; i < pNodes.length; i++) {
    const p = pNodes[i];
    const tNodes = p.getElementsByTagNameNS(WORD_NS, 't');
    let text = '';
    for (let j = 0; j < tNodes.length; j++) {
      const node = tNodes[j];
      if (node.childNodes.length) {
        text += node.childNodes[0].nodeValue || '';
      }
    }
    paragraphs.push(text.trim());
  }
  return paragraphs;
}

/**
 * Representa uma questão (enunciado, resposta correta, erradas, justificativa).
 */
class Question {
  constructor(textLines) {
    this.question = '';
    this.correct_answer = '';
    this.wrong_answer_list = [];
    this.justification = '';

    let t = textLines.shift();
    while (t !== undefined && t !== '#Resposta') {
      this.question += t + '\n';
      t = textLines.shift();
    }

    t = textLines.shift();
    while (t !== undefined && t !== '#Resposta') {
      this.correct_answer += t + '\n';
      t = textLines.shift();
    }

    let buffer = '';
    while (textLines.length) {
      t = textLines.shift();
      if (t === '#Resposta') {
        this.wrong_answer_list.push(buffer.trim());
        buffer = '';
      } else if (t === '#Justificativa') {
        this.wrong_answer_list.push(buffer.trim());
        break;
      } else {
        buffer += t + '\n';
      }
    }

    while (textLines.length) {
      t = textLines.shift();
      this.justification += (this.justification ? '\n' : '') + t;
    }
  }
}

/**
 * Banco de questões: cabeçalho + lista de questões.
 */
class BancoDeQuestoes {
  constructor(header) {
    this.header = header;
    this.question_list = [];
  }

  toXmlString() {
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<quiz>');

    this.question_list.forEach((q, n) => {
      const idx = n + 1;
      lines.push('  <question type="multichoice">');
      lines.push('    <name>');
      lines.push(`      <text><![CDATA[Questão ${idx}]]></text>`);
      lines.push('    </name>');
      lines.push('    <questiontext format="moodle_auto_format">');
      lines.push(`      <text><![CDATA[${escapeCdata(q.question)}]]></text>`);
      lines.push('    </questiontext>');
      lines.push('    <generalfeedback format="moodle_auto_format">');
      lines.push('      <text><![CDATA[]]></text>');
      lines.push('    </generalfeedback>');
      lines.push('    <defaultgrade>1.0000000</defaultgrade>');
      lines.push('    <penalty>0.3333333</penalty>');
      lines.push('    <hidden>0</hidden>');
      lines.push('    <idnumber></idnumber>');
      lines.push('    <single>true</single>');
      lines.push('    <shuffleanswers>true</shuffleanswers>');
      lines.push('    <answernumbering>abc</answernumbering>');
      lines.push('    <correctfeedback format="moodle_auto_format">');
      lines.push('      <text><![CDATA[Sua resposta está correta.]]></text>');
      lines.push('    </correctfeedback>');
      lines.push('    <partiallycorrectfeedback format="moodle_auto_format">');
      lines.push('      <text><![CDATA[Sua resposta está parcialmente correta.]]></text>');
      lines.push('    </partiallycorrectfeedback>');
      lines.push('    <incorrectfeedback format="moodle_auto_format">');
      lines.push('      <text><![CDATA[Sua resposta está incorreta.]]></text>');
      lines.push('    </incorrectfeedback>');
      lines.push('    <shownumcorrect></shownumcorrect>');
      lines.push('    <answer fraction="100" format="moodle_auto_format">');
      lines.push(`      <text><![CDATA[${escapeCdata(q.correct_answer)}]]></text>`);
      lines.push('      <feedback format="moodle_auto_format">');
      lines.push('        <text><![CDATA[]]></text>');
      lines.push('      </feedback>');
      lines.push('    </answer>');
      q.wrong_answer_list.forEach((a) => {
        lines.push('    <answer fraction="0" format="moodle_auto_format">');
        lines.push(`      <text><![CDATA[${escapeCdata(a)}]]></text>`);
        lines.push('      <feedback format="moodle_auto_format">');
        lines.push('        <text><![CDATA[]]></text>');
        lines.push('      </feedback>');
        lines.push('    </answer>');
      });
      lines.push('  </question>');
    });

    lines.push('</quiz>');
    return lines.join('\n');
  }
}

function escapeCdata(s) {
  if (s == null) return '';
  return String(s)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Parse da lista de parágrafos no formato BQ:
 * - Cabeçalho até o primeiro "#Questão"
 * - Blocos separados por "#Questão" ou "#Final"; cada bloco vira uma Question.
 */
function textParse(paragraphs) {
  const doc = [...paragraphs];
  let header = '';
  let paragraph = doc.shift();
  while (paragraph !== undefined && paragraph !== '#Questão') {
    header += (header ? '\n' : '') + paragraph;
    paragraph = doc.shift();
  }

  const responseBQ = new BancoDeQuestoes(header);
  let buffer = [];

  while (doc.length) {
    paragraph = doc.shift();
    if (paragraph !== '#Questão' && paragraph !== '#Final') {
      buffer.push(paragraph);
    } else {
      if (buffer.length) {
        const question = new Question(buffer);
        responseBQ.question_list.push(question);
      }
      buffer = [];
    }
  }
  if (buffer.length) {
    responseBQ.question_list.push(new Question(buffer));
  }

  return responseBQ;
}

/**
 * Fluxo completo: arquivo .docx (File) → XML (string).
 */
async function convertDocxToXml(file) {
  const arrayBuffer = await file.arrayBuffer();
  const paragraphs = await readDocx(arrayBuffer);
  const banco = textParse(paragraphs);
  return banco.toXmlString();
}

// Exportar para uso global no HTML
window.BQConverter = {
  readDocx,
  textParse,
  Question,
  BancoDeQuestoes,
  convertDocxToXml,
};
