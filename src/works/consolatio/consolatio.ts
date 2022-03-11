import consolatioLines from "./parseRawConsolatioText.js"
import rawConsolatio from "./consolatioLatin.js"
import type { Work, WorkSearchResult } from "../work.js"
import { makeSearcher } from "../workUtils.js"

function lineMatcher(i: number, book: string, section: string, line: string) {
	const consolatioLine = consolatioLines[i][0]
	const matcher = `${book}, ${section}, ${line}`
	if (line) {
		return consolatioLine === matcher
	} else {
		return consolatioLine.startsWith(matcher)
	}
}

function parseRoman(raw: string) {
	const values = {
		"i":1
		,"v":5
		,"x":10
		,"l":50
		,"c":100
		,"d":500
		,"m":1000
	}

	raw = raw.trim().toLowerCase()
	let out = 0
	for (let i = 0; i<raw.length; i++) {
		//@ts-ignore
		let val: number | undefined = values[raw[i]]
		if (val === undefined) {
			return NaN
		}
		//@ts-ignore
		let nextVal: number | undefined = (i === raw.length-1 ? 0 : values[raw[i+1]])
		if (nextVal === undefined) {
			return NaN
		}
		if (val < nextVal) {
			out -= val
		} else {
			out += val
		}
	}
	return out
}

function readOriginal(loc: string): WorkSearchResult {
	const match = /^(III|II|I|IV|V)[.,\s]+(?:(\d+)|M[.,\s]*([IVXLC]+))(?:[.,\s]+(\d+)(?:[–—‒―\- ]*(\d+))?)?$/.exec(loc.toUpperCase().trim())
	if (!match) {
		return { success: false, data: "Unable to parse location."}
	}

	const book: string = match[1]
	const prosa: string = match[2]
	const metrum: string = match[3]
	const section = metrum ? "m. "+metrum : prosa
	const lineStart: string = match[4] ?? ""
	const lineEnd: string = match[5] ? match[5] : lineStart


	let startIndex = -1
	let endIndex = -1
	for (let i =0; i<consolatioLines.length; i++) {
		if (lineMatcher(i, book, section, lineStart) && startIndex === -1) {
			startIndex = i
		}
		if (lineMatcher(i, book, section, lineEnd)) {
			endIndex = i+1
		}
	}

	if (startIndex === -1) {
		return { success: false, data: "Unable to find start location."}
	}
	if (endIndex === -1) {
		return { success: false, data: "Unable to find end location."}
	}

	let lines = consolatioLines.slice(startIndex, endIndex)
	const outText = lines.map(([location, text]) => {
		const lineNumber = location.split(",")[2]
		return lineNumber+" "+text
	}).join("\n")
	return {success:true, data:outText, htmlHeader:`<a href="https://faculty.georgetown.edu/jod/boethius/jkok/${parseRoman(book)}${metrum ? "m"+parseRoman(metrum) : "p"+prosa}_n.htm">James J. O’Donnell’s Commentary on this passage</a>`}
}

const Consolatio: Work = {
	searchOriginal:makeSearcher(rawConsolatio)
	,locationFormatHint: 'e.g., "I m. III", "III, 9, 10–30", etc.'
	,readOriginal
	,originalCredit: "test"
}

export default Consolatio
