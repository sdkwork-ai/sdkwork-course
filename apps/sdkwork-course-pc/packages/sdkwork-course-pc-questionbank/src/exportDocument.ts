// Offline document export for papers and handouts: a print stylesheet view
// (browser "保存为 PDF") plus a Word-compatible HTML download (.doc). No
// network, no third-party runtime dependency — the layout is plain HTML/CSS.

import type { Handout, HandoutBlock, Paper, Question } from './questionBankTypes'
import { labelOf, SECTION_LABELS } from './questionBankTypes'

const DOC_STYLES = `
  @page { margin: 18mm 16mm; }
  body { font-family: "Times New Roman", "SimSun", serif; color: #000; font-size: 12pt; line-height: 1.7; }
  .doc-header { text-align: center; }
  .doc-title { font-size: 18pt; font-weight: 700; letter-spacing: 2px; margin: 0 0 4px; }
  .doc-meta { font-size: 10.5pt; margin-bottom: 6px; }
  .doc-note { font-size: 10.5pt; text-align: left; margin: 4px 0 8px; }
  .seal-zone { border: 1px dashed #000; padding: 8px 12px; margin: 0 0 14px; font-size: 10.5pt;
               display: flex; justify-content: space-between; }
  .doc-section { font-weight: 700; margin: 14px 0 6px; font-size: 12.5pt; }
  .doc-question { margin: 8px 0; page-break-inside: avoid; }
  .doc-question .stem { text-align: justify; }
  .doc-options { margin: 2px 0 2px 1.5em; }
  .doc-options .opt { display: inline-block; min-width: 42%; margin-right: 4%; }
  .doc-blank { display: inline-block; min-width: 72px; border-bottom: 1px solid #000; }
  .doc-score { font-size: 10pt; }
  .answer-key { page-break-before: always; }
  .answer-key h2 { text-align: center; font-size: 14pt; }
  .handout-block { margin: 8px 0; page-break-inside: avoid; }
  .handout-block h2 { font-size: 14pt; margin: 12px 0 4px; }
  .handout-block .summary { background: #f3f4f6; padding: 8px 10px; border-left: 3px solid #6366f1; }
  .handout-block .usage-tag { font-size: 9.5pt; color: #555; }
`

const SECTION_TITLES: Record<string, string> = {
  single_choice: '单项选择题',
  multi_choice: '多项选择题',
  true_false: '判断题',
  fill_blank: '填空题',
  solution: '解答题',
  analysis: '辨析题',
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderStemWithBlanks(stem: string): string {
  return escapeHtml(stem).replace(/_{2,}/g, '<span class="doc-blank">&nbsp;</span>')
}

function questionHtml(question: Question, score: string, index: number): string {
  // `index` is the continuous paper-wide number, matching exam convention.

  const options = question.options
    .map(
      (option) =>
        `<span class="opt">${escapeHtml(option.key)}. ${escapeHtml(option.content)}</span>`,
    )
    .join('')
  const scoreTag = score ? `<span class="doc-score">（${escapeHtml(score)} 分）</span>` : ''
  return `<div class="doc-question"><div class="stem">${index}. ${renderStemWithBlanks(
    question.stem,
  )}${scoreTag}</div>${
    options ? `<div class="doc-options">${options}</div>` : ''
  }</div>`
}

function paperBodyHtml(paper: Paper): string {
  const metaBits = [
    labelOf('grade', paper.gradeLevel),
    labelOf('subject', paper.subject),
    paper.examDurationSeconds > 0 ? `考试时长：${Math.round(paper.examDurationSeconds / 60)} 分钟` : '',
    `总分：${paper.totalScore} 分`,
  ].filter(Boolean)
  const sections = new Map<string, Paper['items']>()
  for (const item of paper.items) {
    const bucket = sections.get(item.sectionNo) ?? []
    bucket.push(item)
    sections.set(item.sectionNo, bucket)
  }
  const sectionOrder = [...sections.keys()].sort(
    (a, b) => Number(a) - Number(b),
  )
  let questionCounter = 0
  const sectionHtml = sectionOrder
    .map((sectionNo, sectionIndex) => {
      const items = sections.get(sectionNo) ?? []
      const questionType = items[0]?.question?.questionType ?? ''
      const title = SECTION_TITLES[questionType] ?? '试题'
      const total = items.reduce((sum, item) => sum + (Number(item.score) || 0), 0)
      const body = items
        .map((item) => {
          questionCounter += 1
          return item.question
            ? questionHtml(item.question, item.score, questionCounter)
            : `<div class="doc-question">${questionCounter}.（题目已被删除）</div>`
        })
        .join('')
      return `<div class="doc-section">${SECTION_LABELS[sectionIndex] ?? sectionNo}、${escapeHtml(
        title,
      )}（共 ${items.length} 题，${Number.isInteger(total) ? total : total.toFixed(1)} 分）</div>${body}`
    })
    .join('')

  const sealLine = paper.sealedLine
    ? `<div class="seal-zone"><span>班级：____________</span><span>姓名：____________</span><span>学号：____________</span></div>`
    : ''
  const note = paper.headerNote ? `<p class="doc-note">${escapeHtml(paper.headerNote)}</p>` : ''
  return `${sealLine}${note}${sectionHtml}`
}

function answerKeyHtml(paper: Paper): string {
  const answers = paper.items
    .map((item, index) => {
      const question = item.question
      if (!question) return ''
      const label = `${index + 1}. ${question.answer}`
      const analysis = question.analysis ? `<br/><small>解析：${escapeHtml(question.analysis)}</small>` : ''
      return `<li>${escapeHtml(label)}${analysis}</li>`
    })
    .join('')
  return `<div class="answer-key"><h2>参考答案与解析</h2><ol>${answers}</ol></div>`
}

function paperDocument(paper: Paper, includeAnswers: boolean): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>${escapeHtml(
    paper.title,
  )}</title><style>${DOC_STYLES}</style></head><body>
<div class="doc-header"><p class="doc-title">${escapeHtml(paper.title)}</p>
<p class="doc-meta">${labelOf('grade', paper.gradeLevel)} · ${labelOf('subject', paper.subject)}
　考试时长：${paper.examDurationSeconds > 0 ? `${Math.round(paper.examDurationSeconds / 60)} 分钟` : '不限'}　总分：${escapeHtml(
    paper.totalScore,
  )} 分</p></div>
${paperBodyHtml(paper)}${includeAnswers ? answerKeyHtml(paper) : ''}
</body></html>`
}

function handoutDocument(handout: Handout, questionsById: Map<string, Question>): string {
  const blocks: string[] = []
  let questionCounter = 0
  for (const block of handout.body as HandoutBlock[]) {
    if (block.type === 'heading') {
      blocks.push(`<div class="handout-block"><h2>${escapeHtml(block.content ?? '')}</h2></div>`)
    } else if (block.type === 'text' || block.type === 'summary') {
      const css = block.type === 'summary' ? 'handout-block summary' : 'handout-block'
      blocks.push(`<div class="${css}"><p>${escapeHtml(block.content ?? '')}</p></div>`)
    } else if (block.type === 'question' && block.questionId) {
      const question = questionsById.get(block.questionId)
      questionCounter += 1
      const roleTag =
        block.usageRole === 'example'
          ? '<span class="usage-tag">【例题】</span>'
          : '<span class="usage-tag">【课堂练习】</span>'
      if (!question) {
        blocks.push(`<div class="handout-block">${roleTag}<p>（题目已被删除）</p></div>`)
        continue
      }
      const withAnswer = `
        <div class="handout-block">${roleTag}${questionHtml(question, question.defaultScore, questionCounter)}
        <p><strong>答案：</strong>${escapeHtml(question.answer)}${
          question.analysis ? `<br/><strong>解析：</strong>${escapeHtml(question.analysis)}` : ''
        }</p></div>`
      blocks.push(withAnswer)
    }
  }
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>${escapeHtml(
    handout.title,
  )}</title><style>${DOC_STYLES}</style></head><body>
<div class="doc-header"><p class="doc-title">${escapeHtml(handout.title)}</p>
<p class="doc-meta">${labelOf('grade', handout.gradeLevel)} · ${labelOf('subject', handout.subject)}${
    handout.lessonTag ? `　课时：${escapeHtml(handout.lessonTag)}` : ''
  }　讲义</p></div>
${blocks.join('')}
</body></html>`
}

function openPrintWindow(title: string, html: string): void {
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) {
    document.body.removeChild(frame)
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  const cleanup = () => {
    window.setTimeout(() => {
      if (frame.parentNode) frame.parentNode.removeChild(frame)
    }, 60_000)
  }
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
  cleanup()
}

function downloadWordDocument(fileName: string, html: string): void {
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${fileName}.doc`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function printPaper(paper: Paper, includeAnswers: boolean): void {
  openPrintWindow(paper.title, paperDocument(paper, includeAnswers))
}

export function downloadPaperWord(paper: Paper, includeAnswers: boolean): void {
  downloadWordDocument(paper.title, paperDocument(paper, includeAnswers))
}

export function printHandout(handout: Handout, questionsById: Map<string, Question>): void {
  openPrintWindow(handout.title, handoutDocument(handout, questionsById))
}

export function downloadHandoutWord(
  handout: Handout,
  questionsById: Map<string, Question>,
): void {
  downloadWordDocument(handout.title, handoutDocument(handout, questionsById))
}
