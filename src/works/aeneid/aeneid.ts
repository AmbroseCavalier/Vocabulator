/*
import aeneidEnglish from "./aeneidEnglish.js"
import aeneidLatin from "./aeneidLatin.js"
import { toSearchRegexp } from "../../utils/utils.js"
import type { Work, WorkSearchResult } from "../work.js"

let lineReg = /.+ {5,}(\d+)/g
let currentBook = 0
let lastLineNumber = Infinity

const bookMapping: {[flooredLine: string]: number}[] = []
while (true) {
	let match = lineReg.exec(aeneidLatin)
	if (!match) {
		break
	}

	let lineNum = parseInt(match[1])
	if (lineNum % 5 !== 0) {
		continue
	}
	if (lineNum < lastLineNumber) {
		currentBook++
	}
	lastLineNumber = lineNum
	if (!bookMapping[currentBook]) {
		bookMapping[currentBook] = Object.create(null)
	}
	bookMapping[currentBook][lineNum] = match.index
}
console.log("bookMapping: ",bookMapping)

function extractAeneidAround(startIndex: number, endIndex: number) {
	const margin = 600
	let endIndexExpanded = aeneidLatin.indexOf("\n", endIndex+margin)
	if (endIndexExpanded === -1) {
		endIndexExpanded = aeneidLatin.length
	}
	return aeneidLatin.substring(aeneidLatin.lastIndexOf("\n", startIndex-margin)+1, endIndexExpanded)
}

interface AeneidEnglishBlock {
	start: number
	end: number
	text: string
}

let englishBooks: AeneidEnglishBlock[][] = []
const englishLineReg = /\[(\d+)-\d+\]/g
lastLineNumber = 1
currentBook = 1
while (true) {
	let lastIndex = englishLineReg.lastIndex
	let match = englishLineReg.exec(aeneidEnglish)
	if (!match) {
		break
	}

	let lineNum = parseInt(match[1])
	if (lineNum < lastLineNumber) {
		lastLineNumber = 1
		currentBook++
	}

	if (!englishBooks[currentBook]) {
		englishBooks[currentBook] = []
	}

	let text = aeneidEnglish.substring(lastIndex, match.index)
	englishBooks[currentBook].push({
		start:lastLineNumber
		,end:lineNum
		,text
	})
	lastLineNumber = lineNum
}
console.log(englishBooks)

function findEnglishTranslation(book: number, startLine: number, endLine: number) {
	function rangesIntersect(start1: number, end1: number, start2: number, end2: number): boolean {
		if (start1 > start2) {
			return rangesIntersect(start2, end2, start1, end2)
		}
		return end1 >= start2
	}
	let text = ""
	if (englishBooks[book]) {
		for (let entry of englishBooks[book]) {
			if (rangesIntersect(startLine, endLine, entry.start, entry.end)) {
				text += entry.text+"\n"
			}
		}
	}
	return text
}

function readTranslation(location: string) {
	let [book,line] = location.split(".").map(seg => parseInt(seg.trim()))
	if (!book || !line) {
		return ""
	}
	line = Math.floor(line/5)*5
	if (line === 0) {
		line = 5
	}

	return findEnglishTranslation(book, line, line+2)
}

function readOriginal(location: string): WorkSearchResult {
	let [book,line] = location.split(".").map(seg => parseInt(seg.trim()))
	if (!book || !line) {
		return {success: false, data:"non intellegitur"}
	}

	line = Math.floor(line/5)*5
	if (line === 0) {
		line = 5
	}
	let index = bookMapping[book]?.[line]
	if (!index) {
		return {success: false, data:"inveniri non potest"}
	} else {
		return {success: true, data:extractAeneidAround(index, index+50)}
	}
}

function searchOriginal(query: string): WorkSearchResult {
	let match = toSearchRegexp(query).exec(aeneidLatin)
	if (!match) {
		return {success:false, data:"nulla reperta"}
	} else {
		let startIndex = match.index
		let endIndex = match.index+match[0].length

		return {success: true, data:extractAeneidAround(startIndex, endIndex)}
	}
}

const Aeneid: Work = {
	readOriginal, readTranslation, searchOriginal
	,locationFormatHint: "<book>.<line> (e.g., 6.850)"
	, originalCredit: "TODO Aeneid latin credit", translationCredit: "TODO Aeneid english credit"
}

export default Aeneid
*/
