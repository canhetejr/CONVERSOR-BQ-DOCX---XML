/**
 * Conversor BQ DOCX → XML (Moodle)
 * Versão JavaScript para execução no navegador.
 * Equivalente ao main.py + models.py em Python.
 */

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Extrai os parágrafos de um arquivo .docx (ArrayBuffer).
 * O .docx é um ZIP contendo word/document.xml.
 * Cada w:p vira um item no array (ordem do documento); texto de vários w:t no mesmo parágrafo é concatenado.
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

/** Verifica se a linha é o marcador de justificativa (#Justificativa ou Justificativa). */
function isJustificativaMarker(line) {
  if (line == null) return false;
  const s = String(line).trim();
  return s === '#Justificativa' || s === 'Justificativa' || s === '#Justificativa:' || s === 'Justificativa:';
}

/** Encontra o início de "Justificativa" na linha (com ou sem #) para separar texto antes/depois. */
function splitJustificativaLine(line) {
  if (line == null) return null;
  const s = String(line);
  const lower = s.toLowerCase();
  const idxHash = lower.indexOf('#justificativa');
  const idxPlain = lower.indexOf('justificativa');
  const idx = idxHash >= 0 ? idxHash : idxPlain >= 0 ? idxPlain : -1;
  if (idx < 0) return null;
  const rest = s.slice(idx);
  const markerMatch = rest.match(/^#?justificativa:?\s*/i);
  // Fallback: "#justificativa" = 13 chars, "justificativa" = 12 chars (sem #)
  const len = markerMatch ? markerMatch[0].length : (rest[0] === '#' ? 13 : 12);
  return { before: s.slice(0, idx).trim(), after: s.slice(idx + len).trim() };
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

    // Enunciado: até a primeira linha que seja #Resposta
    let t = textLines.shift();
    while (t !== undefined && String(t).trim() !== '#Resposta') {
      this.question += (t != null ? String(t) : '') + '\n';
      t = textLines.shift();
    }

    // Resposta correta: até a próxima linha #Resposta
    t = textLines.shift();
    while (t !== undefined && String(t).trim() !== '#Resposta') {
      this.correct_answer += (t != null ? String(t) : '') + '\n';
      t = textLines.shift();
    }
    this.question = this.question.trim();
    this.correct_answer = this.correct_answer.trim();

    let buffer = '';
    while (textLines.length) {
      t = textLines.shift();
      const tStr = t != null ? String(t) : '';
      const tTrimmed = tStr.trim();
      if (tTrimmed === '#Resposta') {
        const trimmed = buffer.trim();
        if (trimmed !== '') this.wrong_answer_list.push(trimmed);
        buffer = '';
      } else if (isJustificativaMarker(t)) {
        const trimmed = buffer.trim();
        if (trimmed !== '') this.wrong_answer_list.push(trimmed);
        break;
      } else {
        const split = splitJustificativaLine(t);
        if (split) {
          if (split.before) buffer += split.before + '\n';
          const trimmed = buffer.trim();
          if (trimmed !== '') this.wrong_answer_list.push(trimmed);
          if (split.after) textLines.unshift(split.after);
          break;
        }
        buffer += tStr + '\n';
      }
    }

    // Garantir 5 alternativas no total (1 correta + 4 erradas)
    while (this.wrong_answer_list.length < 4) {
      this.wrong_answer_list.push('');
    }

    // Tudo que sobrou é justificativa (linhas após #Justificativa)
    while (textLines.length) {
      t = textLines.shift();
      const line = t != null ? String(t) : '';
      this.justification += (this.justification ? '\n' : '') + line;
    }
    this.justification = this.justification.trim();
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

  /**
   * Gera XML Moodle. Se questionList for passado, usa apenas essas questões (ex.: aprovadas).
   * @param {Question[]} [questionList] - Lista opcional de questões; se omitido, usa this.question_list.
   */
  toXmlString(questionList) {
    const list = questionList != null ? questionList : this.question_list;
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<quiz>');

    list.forEach((q, n) => {
      const idx = n + 1;
      lines.push('  <question type="multichoice">');
      lines.push('    <name>');
      lines.push(`      <text><![CDATA[Questão ${idx}]]></text>`);
      lines.push('    </name>');
      lines.push('    <questiontext format="moodle_auto_format">');
      lines.push(`      <text><![CDATA[${escapeCdata(q.question)}]]></text>`);
      lines.push('    </questiontext>');
      lines.push('    <generalfeedback format="moodle_auto_format">');
      lines.push(`      <text><![CDATA[${escapeCdata(q.justification || '')}]]></text>`);
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
      lines.push(`        <text><![CDATA[${escapeCdata(q.justification || '')}]]></text>`);
      lines.push('      </feedback>');
      lines.push('    </answer>');
      // Sempre 4 alternativas erradas (total 5 com a correta)
      const wrongList = (q.wrong_answer_list || []).slice(0, 4);
      while (wrongList.length < 4) wrongList.push('');
      wrongList.forEach((a) => {
        const text = a != null ? String(a).trim() : '';
        lines.push('    <answer fraction="0" format="moodle_auto_format">');
        lines.push(`      <text><![CDATA[${escapeCdata(text)}]]></text>`);
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
  const isTag = (p, tag) => p != null && String(p).trim() === tag;
  while (paragraph !== undefined && !isTag(paragraph, '#Questão')) {
    header += (header ? '\n' : '') + (paragraph != null ? String(paragraph) : '');
    paragraph = doc.shift();
  }

  const responseBQ = new BancoDeQuestoes(header.trim());
  let buffer = [];

  while (doc.length) {
    paragraph = doc.shift();
    if (!isTag(paragraph, '#Questão') && !isTag(paragraph, '#Final')) {
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
  const banco = await convertDocxToBanco(file);
  return banco.toXmlString();
}

/**
 * Converte .docx em BancoDeQuestoes (header + question_list) para a UI exibir no modal.
 */
async function convertDocxToBanco(file) {
  const arrayBuffer = await file.arrayBuffer();
  const paragraphs = await readDocx(arrayBuffer);
  return textParse(paragraphs);
}

/**
 * Converte texto BQ (uma linha = um parágrafo) em BancoDeQuestoes. Para uso no editor.
 */
function parseTextToBanco(text) {
  const lines = String(text || '').split(/\r?\n/).map((s) => s.trim());
  return textParse(lines);
}

// Exportar para uso global no HTML
window.BQConverter = window.BQConverter || {};
window.BQConverter.readDocx = readDocx;
window.BQConverter.textParse = textParse;
window.BQConverter.Question = Question;
window.BQConverter.BancoDeQuestoes = BancoDeQuestoes;
window.BQConverter.convertDocxToXml = convertDocxToXml;
window.BQConverter.convertDocxToBanco = convertDocxToBanco;
window.BQConverter.parseTextToBanco = parseTextToBanco;
