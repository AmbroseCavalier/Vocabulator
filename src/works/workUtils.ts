import { toSearchRegexp } from "../utils/utils.js"
import type { Work, WorkSearchResult } from "./work.js"

function makeSearcher(text: string): (text: string) => WorkSearchResult {
	function extractTextAround(startIndex: number, endIndex: number) {
		const margin = 600
		let endIndexExpanded = text.indexOf("\n", endIndex+margin)
		if (endIndexExpanded === -1) {
			endIndexExpanded = text.length
		}
		return text.substring(text.lastIndexOf("\n", startIndex-margin)+1, endIndexExpanded)
	}

	function searchOriginal(query: string): WorkSearchResult {
		let match = toSearchRegexp(query).exec(text)
		if (!match) {
			return {success:false, data:"nulla reperta"}
		} else {
			let startIndex = match.index
			let endIndex = match.index+match[0].length

			return {success: true, data:extractTextAround(startIndex, endIndex)}
		}
	}

	return searchOriginal
}

export { makeSearcher }
