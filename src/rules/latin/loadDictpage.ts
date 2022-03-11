
import { GenerationStep, Headword, Stem } from "../../lemmatizer/lemmatizer.js"
import { latinLemmatizer } from "./init.js"
import { rulesWithOutputParsing } from "./regulars.js"

import "./derivedForms.js"
import "./irregulars"
import "./enclitics"
import "./syncopation"

import { findIrregular } from "./irregulars"

import { Conjugation, Declension, Gender, getStemMetadata, LatinLemmatizerConfig, Parsing, stringifyParsing, Voicing, WordMetadata } from "./types.js"

function splitAtOffsets(str: string, offsets: number[]) {
	let out = []
	out.push(str.substring(0, offsets[0]))
	for (let i = 0; i<offsets.length-1; i++) {
		out.push(str.substring(offsets[i], offsets[i+1]))
	}
	out.push(str.substring(offsets[offsets.length-1]))
	return out
}



async function load() {
	let rawData: string
	//@ts-ignore
	if (window.DEVELOPMENT) {
		console.log("loading dictpage from server...")
		//@ts-ignore
		rawData = await (await window.fetch("/data/DICTPAGE.RAW")).text()
	} else {
		//@ts-ignore
		rawData = await window.DICTPAGE_RAW
	}
	let lines = rawData.split("\n")//.slice(0, 50)

	latinLemmatizer.finishRuleSetup()

	let stemI = 0
	function addStem(word: Headword<LatinLemmatizerConfig>, latin: string, parsing: Parsing) {
		if (!parsing.isStem) {
			parsing.isStem = false
		}

		const parsingStr = stringifyParsing(parsing)
		//console.log("adding",latin, parsingStr)

		const possibleStems = latinLemmatizer.findStemCandidatesFromPrincipalPart({
			word,
			form:latin,
			resultingParsedFormCheck: (step) => step.metadata?.parsingStr === parsingStr,
			ruleConstraint: {
				type:"rule",
				fn: (rule) => (rule.metadata.outParsingStr === parsingStr) && rule.metadata.usedForStemFinding !== false,
				precomputedAllowedRules: rulesWithOutputParsing.get(parsingStr) ?? new Set()
			},
			directStemResultConstraint: {
				type:"stem",
				fn: (stem) => stem.metadata.parsingStr === parsingStr,
				possibleMetadata: new Set([getStemMetadata(parsing)])
			}
		})

		const singlePathStems: Set<Stem<LatinLemmatizerConfig>> = new Set()
		function recurse(step: GenerationStep<LatinLemmatizerConfig> | Stem<LatinLemmatizerConfig>) {
			if (step instanceof GenerationStep) {
				if (step.sources.length === 1) {
					recurse(step.sources[0])
				}
			} else {
				singlePathStems.add(step)
			}
		}

		for (const possible of possibleStems) {
			recurse(possible)
		}

		if (singlePathStems.size === 2) {
			for (const stem of singlePathStems) {
				if (!stem.metadata.parsing.isStem) {
					singlePathStems.delete(stem)
				}
			}
		}

		if (singlePathStems.size === 0) {
			console.warn(`No stem found for part ${latin} of ${word.metadata?.fullLatin}`)
			stemI+=50
		} else if (singlePathStems.size >= 2) {
			console.log(possibleStems)
			console.warn(`Multiple (${singlePathStems.size}) stems found for part (${parsingStr}) ${latin} of ${word.metadata?.fullLatin}`)
		}
		for (const stem of singlePathStems) {
			word.addStem(stem)
			stemI++
		}
		if (stemI > 800) {
		//	throw new Error("Too many stems")
		}
	}

	let currentRawLatin = ""
	let currentRawInfo = ""
	let currentEnglish = ""

	const declMapper: {[code: string]: Declension} = {
		"(1st)": "1st"
		,"(2nd)": "2nd"
		,"(3rd)": "3rd"
		,"(4th)": "4th"
		,"(5th)": "5th"
	}

	const conjMapper: {[code: string]: Conjugation} = {
		"(1st)": "1st"
		,"(2nd)": "2nd"
		,"(3rd)": "3rd"
		,"(4th)": "4th"
	}

	const genderMapper: {[code: string]: Gender} = {
		"M":"m/f"
		,"F":"m/f"
		,"C":"m/f"
		,"N":"neuter"
	}

	const voicingMapper: {[code: string]: Voicing} = {
		"DEP": "deponent"
		,"TRANS":"regular"
		,"SEMIDEP":"semideponent"
		,"PERFDEP":"perfdef"
	}

	function handleWord(entryID: number) {
		if (!currentRawLatin) {
			return
		}
		if (!currentRawLatin.startsWith("#")) {
			console.log({currentRawLatin, currentRawInfo, currentEnglish})
			throw new Error("Parse error")
		}
		currentRawLatin = currentRawLatin.substring(1)
		const doubleSpaceIndex = currentRawLatin.indexOf("  ")
		if (doubleSpaceIndex === -1) {
			throw new Error("Parse error")
		}
		const mainText = currentRawLatin.substring(0, doubleSpaceIndex)
		const typeAndOtherInfo = currentRawLatin.substring(doubleSpaceIndex).trim()
		const infoSplit = typeAndOtherInfo.split(/\s+/)
		const partOfSpeech = infoSplit[0]

		const entry: WordMetadata = {
			mainLatin:mainText
			,typeAndOtherInfo
			,fullLatin:currentRawLatin.trim()
			,info:currentRawInfo.trim()
			,english:currentEnglish.trim().replace(/=>/g, "⇒")
			,id:entryID.toString()
		}
		const word = findIrregular(entry.id, entry.fullLatin) ?? new Headword(latinLemmatizer, new Set())
		word.metadata = entry

		const parts = mainText.split(",").map(seg => seg.trim()).filter(seg => seg).filter(seg => seg !== "-")
		switch (partOfSpeech) {
			case "N": {
				let [,declRaw,genderRaw] = infoSplit
				const declension = declMapper[declRaw]
				let gender = genderMapper[genderRaw]
				if (declension && gender) {

					if (parts.length === 2) {
						let [part1, part2] = parts
						if (declension === "2nd" && part1.endsWith("us") && gender === "neuter") {
							//TODO: in the rare cases this is triggered it may not be that the dictionary is wrong
							//e.g., vulgus, i, n. IS actually neuter, though it is declined like a masculine.
							//How should this be represented? Making another declension seems weird,
							//but so does having the gender for declension purposes be different from
							//the actual gender.
							gender = "m/f"
						}
						if ((declension === "2nd" && gender === "m/f") || declension === "3rd") {
							addStem(word, part1, {type:"noun", isStem:false, declension, case:"nominative", gender, quantity:"singular"})
						}
						part2 = part2.replace(/\(i\)$/, "i")
						addStem(word, part2, {type:"noun", isStem:false, declension, case:"genitive", quantity:"singular", gender})
					}
				}
				break
			}
			case "V": {
				let [,conjRaw,voicingRaw] = infoSplit
				let conjugation = conjMapper[conjRaw]
				const voicing = voicingMapper[voicingRaw] ?? "regular"
				if (conjugation && voicing) {
					let [present, inf, perf, ppp] = parts

					if (ppp && ppp !== "-") {
						if (voicing !== "regular") {
							throw new Error("Parse error")
						}
						addStem(word, ppp, {type:"participle", isStem:false, conjugation, tense:"perfect", voice:"passive", voicing:"regular", gender:"masc", quantity:"singular", case:"nominative"})
					}
					if (perf && perf !== "-") {
						if (voicing === "deponent") {
							perf = perf.replace(/ sum$/, "").trim()
							addStem(word, perf, {type:"participle", isStem:false, conjugation, tense:"perfect", voice:"active", voicing:"deponent", gender:"masc", quantity:"singular", case:"nominative"})
						} else if (voicing === "regular") {
							addStem(word, perf, {type:"verb", mood:"indicative", isStem:false, conjugation, tense:"perfect", voice:"active", voicing:"regular", person:"1st", quantity:"singular"})
						}
					}
					if (present && present !== "-") {
						if (conjugation === "3rd") {
							if ((voicing === "deponent" && present.endsWith("ior")) || (voicing === "regular" && present.endsWith("io"))) {
								conjugation = "3rd I-stem"
							}
						}

						if (voicing === "deponent" || voicing === "regular") {
							addStem(word, present, {type:"verb", mood:"indicative", isStem:false, conjugation, tense:"present", voice:"active", voicing, quantity:"singular", person: "1st"})
						}
					}
				}
				break
			}
			case "ADJ": {
				if (parts.length === 4) {
					parts[0] += " "+parts[1]
					parts.splice(1, 1)
				}
				if (parts.length === 3) {
					if (parts[0].endsWith("a -um") || parts[1].endsWith("a -um")) {
						let splitAgain = mainText.split(/[,\s]+/).map(seg => seg.trim())
						let mascPart = splitAgain[0]
						if (mascPart) {
							if (!mascPart.endsWith("er") && !mascPart.endsWith("us")) {
								console.log(mainText)
							}
							let femPart = splitAgain[1]
							addStem(word, mascPart, {type:"adjective", degree:"positive", isStem:false, declension:"2nd", case:"nominative", quantity:"singular", gender:"masc"})
							addStem(word, femPart, {type:"adjective", degree:"positive", isStem:false, declension:"2nd", case:"nominative", quantity:"singular", gender:"fem"})
						}
					} else {
						let [part1, part2, part3] = parts
						if (part1.endsWith("us") && part2.endsWith("a") && part3.endsWith("um")) {
							addStem(word, part1, {type:"adjective", degree:"positive", isStem:false, declension:"2nd", case:"nominative", quantity:"singular", gender:"masc"})
							addStem(word, part2, {type:"adjective", degree:"positive", isStem:false, declension:"2nd", case:"nominative", quantity:"singular", gender:"fem"})
						} else {
							let mascNomSingular
							let femNomSingular
							let neuterNomSingular
							let mascGenSingular

							let splitAgain = part1.split(/\s+/)
							if (part1.endsWith("-e")) {
								if (splitAgain.length !== 3) {
									break
								}
								//3 terminations

								mascNomSingular = splitAgain[0]
								femNomSingular = splitAgain[1]
								if (!femNomSingular.endsWith("is")) {
									break
								}
								neuterNomSingular = femNomSingular.substring(0, femNomSingular.length-2)+"e"
								mascGenSingular = femNomSingular
							} else if (part1.endsWith("e") && splitAgain.length === 2) {
								//two terminations
								mascNomSingular = splitAgain[0]
								femNomSingular = splitAgain[0]
								neuterNomSingular = splitAgain[1]
								mascGenSingular = splitAgain[0]
							} else if (part2 === "(gen.)" || part1.endsWith("(gen.)")) {
								if (part1.endsWith("(gen.)")) {
									if (splitAgain.length !== 3) {
										break
									}
									part1 = splitAgain[0]
									part3 = splitAgain[1]
									part2 = splitAgain[2]
								}


								//one termination 3rd adjective


								mascNomSingular = part1
								femNomSingular = part1
								neuterNomSingular = part1
								mascGenSingular = part3
							} else {
								if (part2.endsWith("(gen.)")) {
									part2 = part2.replaceAll("(gen.)", "").trim()
								}
								mascNomSingular = part1
								femNomSingular = part2
								neuterNomSingular = part3
								mascGenSingular = part2
							}

							addStem(word, mascNomSingular, {type:"adjective", degree:"positive", isStem:false, declension:"3rd", case:"nominative", quantity:"singular", gender:"masc"})
							addStem(word, femNomSingular, {type:"adjective", degree:"positive", isStem:false, declension:"3rd", case:"nominative", quantity:"singular", gender:"fem"})
							addStem(word, neuterNomSingular, {type:"adjective", degree:"positive", isStem:false, declension:"3rd", case:"nominative", quantity:"singular", gender:"neuter"})
							addStem(word, mascGenSingular, {type:"adjective", degree:"positive", isStem:false, declension:"3rd", case:"genitive", quantity:"singular", gender:"masc"})
						}
					}
				}
				break
			}
		}

		if (word.stems.size === 0) {
			for (const part of parts) {
				addStem(word, part, {type:"unknown"})
			}
		}

		if (word.stems.size > 0) {
			latinLemmatizer.addWord(word)
		}

		currentRawLatin = ""
		currentRawInfo = ""
		currentEnglish = ""
	}

	for (let i = 0; i<lines.length; i++) {
		const line = lines[i]
		if (!line.trim()) {
			continue
		}
		let [latin, info, spacer, english] = splitAtOffsets(line, [101, 108, 112])
		if (english.startsWith("|")) {
			currentEnglish += " "+english.replace(/^\|+/, "")
		} else {
			handleWord(i)
			currentEnglish = english
		}
		currentRawLatin = latin
		currentRawInfo = info
	}


}

export { load as loadDict, Headword as DictionaryWord }

/*

async function main() {
	let dict = await load()

	function lookup(word: string) {
		console.time("lookup")
		let results = dict.lookup(word)
		console.timeEnd("lookup")
		return `RESULTS FOR "${word}"

${results.length === 0 ? "No results" : results.map(result => (result.path[0].node.name ?? "Unknown declension" )+"\n"+result.result).join("\n")}`
	}

	console.log(lookup("militem"))
	console.log(lookup("militum"))
	console.log(lookup("verbum"))
	console.log(lookup("servis"))
	console.log(lookup("agricolas"))
	console.log(lookup("agricolae"))
	console.log(lookup("amabas"))
	console.log(lookup("amare"))
	console.log(lookup("amo"))
	console.log(lookup("tectura"))
	console.log(lookup("amando"))
	console.log(lookup("conarer"))
	console.log(lookup("coneris"))
	console.log(lookup("amans"))
	console.log(lookup("amantium"))
	console.log(lookup("aegris"))
	console.log(lookup("aegrius"))
	console.log(lookup("aegrissimis"))
	console.log(lookup("conantis"))
	console.log(lookup("conantes"))
	console.log(lookup("capio"))
	console.log(lookup("audio"))
	console.log(lookup("navium"))
	console.log(lookup("fecerint"))
}
main()
*/
