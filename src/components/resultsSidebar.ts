import { findWords } from "../utils/utils.js"
import { customText, currentWork, printFontSize, printNColumns, knownWords, customResults,parsingsDisplayMode, workSearchMode, searchText, searchLocation, hoverWord, activeWord, printMode, toggleKnown, cosmeticUV, currentTextResult, printHeader } from "../state/state.js"
import * as D from "dynein"
import tabs from "./tabs.js"
import toggle from "./toggle.js"
import integerInput from "./integerInput.js"

type Result = GenerationStep<LatinLemmatizerConfig> | Stem<LatinLemmatizerConfig> | WordMetadata

import radio from "./radio.js"

import print from "../utils/print.js"
import { Stem, GenerationStep } from "../lemmatizer/lemmatizer.js"
import { LatinLemmatizerConfig, Parsing, shortStringifyParsing, stringifyParsing, WordMetadata } from "../rules/latin/types.js"
import { latinLemmatizer } from "../rules/latin/init.js"


const $if = D.addIf
const $text = D.addText

const { textarea, div, button, ul, li, input, span, br, dl, dd, hr, p } = D.elements

function superscriptify(text: string) {
	return text.replace(/(\d+)(st|nd|rd|th)/gi, "$1<sup>$2</sup>")
}

enum RenderMode {
	hover = "hover"
	,preview = "preview"
	,print = "print"
}

function latinClickHandler(evt: MouseEvent, word: string, mode: RenderMode) {
	if (evt.ctrlKey) {
		let nowKnown = toggleKnown(word)
		if (nowKnown && activeWord() === word) {
			activeWord("")
		}
	} else if (mode === "preview") {
		activeWord(word)
	}
}



function findBaseEntry(result: Result): WordMetadata | null {
	if (result instanceof GenerationStep) {
		if (result.sources.length === 1) {
			const source = result.sources[0]
			return findBaseEntry(source)
		}
	} else if (result instanceof Stem) {
		return result.headword.metadata  ?? null
	} else {
		return result
	}
	return null
}

type RenderTreeLevel = {
	description: string
	render: (inner: ()=>void, anyInner: boolean)=>void
	children: RenderTreeLevel[]
}

function renderHoverResult(result: Result): RenderTreeLevel[] {
	if (result instanceof GenerationStep) {
		const step = (result as GenerationStep<LatinLemmatizerConfig>)

		const explanation = step.rule.metadata.explanation
		if (!explanation) {
			if (step.rule.metadata.outParsing && step.sources.length === 1) {
				const innerRenderedList = renderHoverResult(step.sources[0])
				if (innerRenderedList.length === 1) {
					const innerRendered = innerRenderedList[0]

					if (innerRendered.description.startsWith("stemouter:")) {
						const stemInner = innerRendered.children[0]
						if (step.rule.metadata.outParsing.isStem) {
							stemInner.children = [] // this rule and any rule below it should not be shown
						} else {
							const parsingStr = stringifyParsing(step.rule.metadata.outParsing)
							const shortParsingStr = shortStringifyParsing(step.rule.metadata.outParsing)

							insertRenderLevelInto(stemInner.children, {
								description: "rule: "+step.rule.debugName,
								render: (inner, anyInner) => {
									$if(()=>parsingsDisplayMode() > 0, ()=>{
										div({style:"font-family:'Times New Roman', serif;letter-spacing:0px;"}, ()=>{
											D.addDynamic(()=>{
												D.addHTML(superscriptify(parsingsDisplayMode() === 2 ? parsingStr : shortParsingStr))
											})
										})
									})

									if (anyInner) {
										$text("UNEXPECTED RENDERING STATE?")
										div({class:"ms-5"}, ()=>{
											inner()
										})
									}
								},
								children:[]
							})
						}
						return innerRenderedList
					}
				}
			}
			const out: RenderTreeLevel[] = []
			for (const child of step.sources) {
				out.push(...renderHoverResult(child))
			}
			return out
		} else {
			const explanationHeadingText = typeof explanation.heading === "function" ? explanation.heading(step) : explanation.heading
			const level: RenderTreeLevel = {
				description: "rule: "+explanationHeadingText,
				render: (inner, anyInner) => {
					div({style:"font-weight:bold;font-size:1.2em;"},explanationHeadingText)
					div({class:"ms-3"}, ()=>{
						D.addHTML(explanation.htmlBody)
					})

					if (anyInner) {
						div({class:"ms-5"}, ()=>{
							inner()
						})
					}
				},
				children:[]
			}
			for (const child of step.sources) {
				level.children.push(...renderHoverResult(child))
			}
			return [level]
		}
	} else if (result instanceof Stem) {
		const stem = (result as Stem<LatinLemmatizerConfig>)
		return [{
			description: "stemouter: "+stem.headword.metadata?.english,
			render: (inner, anyInner) => {
				const metadata = stem.headword.metadata
				if (metadata) {
					const {mainLatin: latin, typeAndOtherInfo, english} = metadata
					div({style:"font-weight:bold;font-size:1.2em;"},english)
					inner()
				} else {
					div("ERR: NO HEADWORD METADATA FOR stem "+stem.form)
				}
			},
			children:[{
				description: "steminner: "+stem.headword.metadata?.id,
				render: (inner, anyInner) => {
					const metadata = stem.headword.metadata
					if (metadata) {
						const {mainLatin: latin, typeAndOtherInfo, english} = metadata
						div({style:"font-style:italic;margin-left:1.5rem"}, ()=>{
							$text(latin)
							if (typeAndOtherInfo) {
								span({style:"margin-left:1em;font-size:0.6em;font-family:'Times New Roman', serif;"}, " ["+typeAndOtherInfo+"]")
							}
						})

						if (anyInner) {
							div({class:"ms-5"}, ()=>{
								inner()
							})
						}
					}
				},
				children: []
			}]
		}]
	} else {
		const metadata: WordMetadata = result
		return [{
			description: "metadata: "+metadata.fullLatin,
			render: (inner, anyInner) => {
				$text("word: "+metadata.fullLatin)

				if (anyInner) {
					div({class:"ms-5"}, ()=>{
						inner()
					})
				}
			},
			children:[]
		}]
	}
}

function insertRenderLevelInto(acc: RenderTreeLevel[], level: RenderTreeLevel) {
	for (const prev of acc) {
		if (prev.description === level.description) {
			for (const child of level.children) {
				insertRenderLevelInto(prev.children, child)
			}
			return
		}
	}

	const prev = acc[acc.length-1]
	if (prev && prev.children.length === 1 && prev.children[0].description === level.children[0]?.description) {
		const removed = prev.children.pop()!
		const ownChildren = level.children
		level.children = []
		acc.push(level)
		insertRenderLevelInto(level.children, removed)
		for (const child of ownChildren) {
			insertRenderLevelInto(level.children, child)
		}
		return
	}
	acc.push(level)
}

function renderHoverResults(results: Result[]) {
	const rootAcc: RenderTreeLevel[] = []



	for (const res of results) {
		const rendered = renderHoverResult(res)
		for (const r of rendered) {
			insertRenderLevelInto(rootAcc, r)
		}
	}

	function renderLevel(level: RenderTreeLevel) {
		level.render(()=>{
			for (const child of level.children) {
				renderLevel(child)
			}
		}, level.children.length > 0)
	}

	for (const level of rootAcc) {
		renderLevel(level)
	}
}


function renderResult(result: Result | WordMetadata , prev: Result | undefined, word: string, mode: RenderMode) {
	let parsing: Parsing | null = result instanceof GenerationStep || result instanceof Stem ? result.metadata?.parsing ?? null : null
	let parsingStr: string = parsing ? stringifyParsing(parsing) : ""
	let shortParsingStr: string = parsing ? shortStringifyParsing(parsing) : ""

	const prevEntry = prev ? findBaseEntry(prev) : null
	const entry = findBaseEntry(result)
	if (entry) {
		let {mainLatin: latin, typeAndOtherInfo, english} = entry
		if (prevEntry?.id !== entry.id) {
			if (parsingStr.includes("2nd declension positive adjective")) {
				let main = /^.+?\b/.exec(latin)?.[0]
				if (main) {
					latin = main+", -a, -um"
				}
			} else if (parsingStr.includes("1st declension noun")) {
				let main = /^.+?\b/.exec(latin)?.[0]
				if (main) {
					latin = latin.replace(main+"e", "-ae")
				}
			}

			if (mode !== "hover") {
				D.elements.u({onclick:(evt: MouseEvent)=>{
					latinClickHandler(evt, word, mode)
				}, class:()=>(mode === "preview" && activeWord() === word) ? "result active" : "result"},()=>{
					D.elements.b((latin+" "+typeAndOtherInfo).trim())
				})
				D.elements.span(" "+english)
			} else {
				if (prevEntry?.english !== entry.english) {
					span({style:"font-weight:bold;font-size:1.2em;"},english)
					br()
				}
				D.elements.i({style:"margin-left:1.5em"}, " "+latin)
				if (typeAndOtherInfo) {
					span({style:"margin-left:1em;font-size:0.6em;font-family:'Times New Roman', serif;"}, " ["+typeAndOtherInfo+"]")
				}
			}
			br()
		}

		if (parsingStr !== "" && mode === "hover") {
			$if(()=>parsingsDisplayMode() > 0, ()=>{
				span({style:"margin-left:3em;font-family:'Times New Roman', serif;letter-spacing:0px;"}, ()=>{
					D.addDynamic(()=>{
						D.addHTML(superscriptify(parsingsDisplayMode() === 2 ? parsingStr : shortParsingStr))
					})
				})
				br()
			})
		}
	}
}


function renderResults(word: string, results: Result[], mode: RenderMode) {
	if (mode === RenderMode.hover) {
		renderHoverResults(results)
		return
	}
	results.sort((a,b) => {
		let out = findBaseEntry(a)?.mainLatin.localeCompare(findBaseEntry(b)?.mainLatin ?? "") ?? 0
		if (out !== 0) {
			return out
		} else {
			return findBaseEntry(a)?.english.localeCompare(findBaseEntry(b)?.english ?? "") ?? 0
		}
	})
	for (let i = 0; i<results.length; i++) {
		renderResult(results[i], results[i-1], word, mode)
	}
}

function renderCustomResults(word: string, nRegularResults: number, mode: RenderMode) {
	D.addAsyncReplaceable(($r)=>{
		D.createEffect(()=>{
			let ignoreCheck = word.toLowerCase()
			let rawText = (customResults.get(ignoreCheck)??"").trim()
			let lines = rawText ? rawText.split(/\n+/) : []
			let otherResults: WordMetadata[] = []
			for (let i = 0; i<lines.length; i+=2) {
				let latin = lines[i]
				let english = lines[i+1] ?? ""
				const id = `${latin};;;${english}`
				otherResults.push({
					fullLatin:latin
					,typeAndOtherInfo:""
					,mainLatin:latin
					,english
					,info:""
					,id
				})
			}

			$r(()=>{
				if (mode !== "hover" && otherResults.length === 0 && nRegularResults === 0) {
					D.elements.u({onclick:(evt: MouseEvent)=>{
						latinClickHandler(evt, word, mode)
					}, class:()=>(mode === "preview" && activeWord() === word) ? "result active" : "result", style:"font-weight:bold"},word)
					D.addText(" ")
					span({style:"background-color:orange;font-weight:bold"}, "NO RESULTS")
					br()
				} else if (otherResults.length > 0) {
					div({style:"border:1px solid black; break-inside: avoid;"}, ()=>{
						D.elements.i("Custom results for ")
						D.elements.b(word)
						br()
						for (let result of otherResults) {
							renderResult(result, undefined, word, mode)
						}
					})
				}
			})
		})
	})
}

function renderAllWords(mode: RenderMode) {
	D.addDynamic(()=>{
		let resultGroups: {word: string, results: Result[]}[] = []
		const result = currentTextResult()
		if (!result.success) {
			//do nothing
		} else {
			findWords(result.data, word=>{
				resultGroups.push({word, results:Array.from(latinLemmatizer.lookup(word))})
			},()=>{})
			for (let {word, results} of resultGroups) {
				$if(()=>!knownWords.has(word.toLowerCase()),()=>{
					renderResults(word, results, mode)
					renderCustomResults(word, results.length, mode)
				})
			}
		}
	})
}

function renderForPrint() {
	D.untrack(()=>{
		div({style:`columns: ${printNColumns()}; font-size: ${printFontSize()}pt; column-fill: auto;`}, ()=>{
			D.elements.u({style:"white-space: pre-wrap"}, D.sample(printHeader))
			br()
			renderAllWords(RenderMode.print)
		})
	})
}


export default function resultsSidebar() {


	tabs([{
		name:"Hover Only"
		,inner:()=>{
			D.addDynamic(()=>{
				//console.time("Rerender results pane")
				span("Parsing Display: ")
				radio(["None", "Short", "Long"], parsingsDisplayMode)

				let word = activeWord() || hoverWord()
				D.elements.h3(word)
				let ignoreCheck = word.toLowerCase()
				let regularResults = Array.from(latinLemmatizer.lookup(word))

				toggle("Known", knownWords.port(word.toLowerCase()) as D.Signal<boolean>)

				br()
				if (regularResults.length === 0) {
					span("No results.")
				} else {
					renderResults(word, regularResults, RenderMode.hover)
				}
				D.elements.h3({class:"mt-3"}, "Custom Results")
				textarea({value: D.toSignal<string>(()=>customResults.get(ignoreCheck) ?? "", (v) => customResults.set(ignoreCheck, v)), class:"form-control", placeholder:"Put custom results here, with Latin and English on alternate lines."})
				br()
				renderCustomResults(word, regularResults.length, RenderMode.hover)
				//console.timeEnd("Rerender results pane")
			})
		}}
		,{
			name:"For Print"
			,inner:()=>{
				textarea({value: printHeader, class:"form-control", placeholder:"Enter a print header here..."})
				div({class:"row g-3 align-items-center"}, ()=>{
					div({class:"col-md-8 col-sm-12"},()=>{
						integerInput("Font Size", "pt", 8, 4, 16, printFontSize)
					})
					div({class:"col-md-4 col-sm-12"},()=>{
						integerInput("Columns", "", 4, 1, 6, printNColumns)
					})
				})
				button({onclick:()=>{
					print(()=>{
						renderForPrint()
					})
				}, class: "btn btn-primary"}, "Print")
				hr()
				renderAllWords(RenderMode.preview)
			}
		}]
	,printMode)
}
