import * as D from "dynein"
import PersistentStore from "./store.js"
import { replaceMacrons } from "../utils/utils.js"
import works from "../works/index.js"
import type { Work, WorkSearchResult } from "../works/work.js"

const $ = D.createSignal

const store = new PersistentStore("vocabulator", 1, [
	obj => {
		if (obj.showParsings) {
			if (obj.longParsings) {
				obj.parsingsDisplayMode = 2
			} else {
				obj.parsingsDisplayMode = 1
			}
		} else {
			obj.parsingsDisplayMode = 0
		}
	}
])

// persistent
const cosmeticUV = store.value("cosmeticUV", true as boolean)
const currentWork = store.value("activeWork", "Custom" as string)
const customText = store.value("customText", "neque porro quisquam est, qui dolorem ipsum, quia dolor sit amet consectetur adipisci velit.\n-Cicero" as string)

const customResults = store.map("manualResults", [])
const knownWords = store.fastSet("knownWords", [])

const printHeader = store.value("printHeader", "" as string)

const parsingsDisplayMode = store.value("parsingsMode", 0 as number)

const loadingQuoteN = store.value("loadingQuote", 0 as number)

const printFontSize = store.value("printFontSize", 8 as number)
const printNColumns = store.value("printNColumns", 4 as number)

const breakAtNumbers = store.value("breakAtNumbers", false as boolean)

// impersistent
const searchText = $("")
const searchLocation = $("")

const hoverWord = $("")
const activeWord = $("")
const printMode = $(0)
const showTranslation = $(false)

const workSearchMode = $(0)

function toggleKnown(word: string) {
	word = word.toLowerCase()
	const port = knownWords.port(word)
	return port(!port())
}

const currentTextResult = D.createRootScope(()=>D.createMemo(()=>{
	activeWord("") //clear on text change
	if (currentWork() === "Custom") {
		return {
			success:true
			,data: customText()
		}
	} else {
		//@ts-ignore
		let work: Work | undefined = works[currentWork()]
		if (!work) {
			return {
				success:false
				,data:"internal error fetching work"
			}
		}
		if (workSearchMode() === 1 && work.searchOriginal) { //search
			return work.searchOriginal(searchText())
		} else { //location
			return work.readOriginal(searchLocation())
		}
	}
}))

export { cosmeticUV, loadingQuoteN, breakAtNumbers, printFontSize, printNColumns, currentWork, knownWords, customText, parsingsDisplayMode, customResults, searchText, searchLocation, hoverWord, activeWord, showTranslation, workSearchMode, toggleKnown, printMode, currentTextResult, printHeader}
