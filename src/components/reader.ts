import type { Work } from "../works/work.js"

import { cosmeticFixUV, css, findWords } from "../utils/utils.js"

import { customText, currentWork, breakAtNumbers, knownWords, workSearchMode, searchText, searchLocation, hoverWord, activeWord, printMode, toggleKnown, cosmeticUV, currentTextResult } from "../state/state.js"

import dropdown from "./dropdown.js"
import * as D from "dynein"
import tabs from "./tabs.js"
import toggle from "./toggle.js"

const $if = D.addIf
const $text = D.addText

const { textarea, div, button, ul, li, input, span, br } = D.elements

import works from "../works/index.js"

export default function reader() {
	div({class:"border-bottom"}, ()=>{
		const workNames = Object.keys(works)
		workNames.unshift("Custom")
		span("Work: ");dropdown(workNames, currentWork)

		$if(()=>(currentWork() === "Custom"), ()=>{
			div(()=>{
				textarea({value:customText, class:"form-control"})
			})
		}).else(()=>{
			//@ts-ignore
			const currentWorkObj: Work = works[currentWork()]
			tabs([{
				name:"Location"
				,inner:()=>{
					input({type:"text",style:"font-family:'Times New Roman', serif;",class:"form-control", placeholder:currentWorkObj.locationFormatHint, value:searchLocation})
				}
			},{
				name:"Search"
				,inner:()=>{
					input({type:"text", class:"form-control", placeholder:"e.g., arma virumque", value:searchText})
				}
			}], workSearchMode)
		})

		div({class:"row align-items-center"}, ()=>{
			div({class:"col"}, ()=>{
				toggle("Consonantal u → v", cosmeticUV)
			})
			div({class:"col"}, ()=>{
				toggle("Break at Numbers", breakAtNumbers)
			})
		})
	})

	div({style:"white-space: pre-wrap;", class:"reader"}, ()=>{
		D.addDynamic(()=>{
			const result = currentTextResult()
			if (result.htmlHeader) {
				D.addHTML(result.htmlHeader)
				br()
			}
			if (!result.success) {
				D.elements.i(result.data)
			} else {
				let replacedText = result.data.replace(/--/g, "—")
				if (breakAtNumbers()) {
					replacedText = replacedText.replace(/[\[\{\(]?\d+[\]\}\)\.]?/g, "\n$&").trim()
				}
				findWords(replacedText, word=>{
					span({onMouseEnter:()=>{
						hoverWord(word)
					//@ts-ignore
					},onclick:(evt: MouseEvent)=>{
						if (evt.ctrlKey) {
							toggleKnown(word)
						} else {
							if (printMode() === 0) {
								if (activeWord() === word) {
									activeWord("")
								} else {
									activeWord(word)
								}
							} else {
								activeWord(word)
								printMode(0)
							}
						}
					},class:()=>`word ${activeWord() === word ? "active" : ""} ${knownWords.has(word.toLowerCase()) ? "ignored" : ""}`},()=>{
						D.addText(()=> cosmeticUV() ? cosmeticFixUV(word) : word )
					})
				}, between=>{
					span(between)
				})
			}
		})
	})
}
