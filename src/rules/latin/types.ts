import { GenerationStep } from "../../lemmatizer/lemmatizer"

// This section of naming based on/copied from the similar typedefs in William Whittaker's Words
export type WordType = "unknown" | "verb" | "noun" | "adjective" | "generatedAdverb" | "participle" | "supine" | "infinitive" | "gerund" | "gerundive" | "imperative"
export type Gender = "masc" | "fem" | "m/f" | "neuter"
export type Declension = "1st" | "2nd" | "3rd" | "3rd I-stem" | "4th" | "5th"
export type Conjugation = "1st" | "2nd" | "3rd" | "3rd I-stem" | "4th" | "esse-like" | "irregular"
export type Mood = "indicative" | "subjunctive"
export type Voicing = "regular" | "deponent" | "semideponent" | "perfdef"
export type Voice = "active" | "passive"
export type Tense = "future" | "future perfect" | "present" | "imperfect" | "perfect" | "pluperfect"
export type Degree = "positive" | "comparative" | "superlative"
export type Case = "nominative" | "vocative" | "genitive" | "dative" | "accusative" | "ablative" | "locative"
export type Quantity = "singular" | "plural"
export type Person = "1st" | "2nd" | "3rd"


export type Parsing = {
	type?: WordType
	,gender?: Gender
	,declension?: Declension
	,conjugation?: Conjugation
	,mood?: Mood
	,voicing?: Voicing
	,voice?: Voice
	,tense?: Tense
	,degree?: Degree
	,case?: Case
	,quantity?: Quantity
	,person?: Person
	,isStem?: boolean
	,alternateForm?: number
}


export type StemMetadata = {
	parsingStr: string,
	parsing: Parsing
}

export function getStemMetadata(parsing: Parsing): StemMetadata {
	return {
		parsingStr: stringifyParsing(parsing)
		,parsing
	}
}

export type RuleExplanation = {
	heading: string | ((step: GenerationStep<LatinLemmatizerConfig>) => string),
	htmlBody: string
}

export type RuleMetadata = {
	inParsingStr: string,
	outParsingStr: string,
	outParsing?: Parsing,

	explanation?: RuleExplanation

	// See loadDictpage.ts for details of how this is used. In most cases, this is unspecified and
	// is treated as true. But for a small set of special-case rules (such as adding -itas to an
	// adjective to make a noun), this is set to false. This is so when loading dictionary entries
	// that are already -itas nouns (e.g., "bonitas, bonitatis") it doesn't find "bon-" as a stem.
	usedForStemFinding?: boolean
}

export type WordMetadata = {
	readonly mainLatin: string
	readonly typeAndOtherInfo: string
	readonly fullLatin: string
	readonly english: string
	readonly info: string
	readonly id: string
}

export type LatinLemmatizerConfig = {
	StemMetadata: StemMetadata,
	RuleMetadata: RuleMetadata,
	HeadwordMetadata: WordMetadata,
	GenerationMetadata: StemMetadata
}

const shortGenders: { [gen in Gender]: string} = {
	"masc": "m."
	,"m/f": "m/f."
	,"fem": "f."
	,"neuter": "n."
}

const shortTypes: { [type in WordType]: string} = {
	"unknown": "!!!",
	"verb": "v."
	,"noun": "n."
	,"adjective": "adj."
	,"generatedAdverb": "adv."
	,"participle": "part."
	,"supine": "sup."
	,"infinitive": "inf."
	,"gerund": "grnd."
	,"gerundive": "grndv."
	,"imperative": "imp."
}

const shortTenses: { [tense in Tense]: string} = {
	"future": "fut."
	,"future perfect": "fut. perf."
	,"present": "pres."
	,"imperfect": "imp."
	,"perfect": "perf."
	,"pluperfect": "pluperf."
}

const shortQuantities: { [quant in Quantity]: string} = {
	"singular": "sg."
	,"plural": "pl."
}

const shortCases: { [c in Case]: string} = {
	"nominative": "nom."
	,"vocative": "voc."
	,"genitive": "gen."
	,"dative": "dat."
	,"accusative": "acc."
	,"ablative": "abl."
	,"locative": "loc."
}

const shortVoices: { [v in Voice]: string} = {
	"active": "act."
	,"passive": "pass."
}

const shortMoods: { [v in Mood]: string} = {
	"indicative": "ind."
	,"subjunctive": "subj."
}

const shortDescriptionStrings = {
	tense: shortTenses
	,quantity: shortQuantities
	,case: shortCases
	,gender: shortGenders
	,type: shortTypes
	,voice: shortVoices
	,mood: shortMoods
}

export type ParsingPermutationSet = {
	type?: WordType[]
	,gender?: Gender[]
	,declension?: Declension[]
	,conjugation?: Conjugation[]
	,mood?: Mood[]
	,voicing?: Voicing[]
	,voice?: Voice[]
	,tense?: Tense[]
	,degree?: Degree[]
	,case?: Case[]
	,quantity?: Quantity[]
	,person?: Person[]
	,isStem?: boolean[]
	,alternateForm?: number[]
}

export type ParsingKey = keyof Parsing


export const standardOrdering = ["person", "case", "gender", "quantity",  "tense", "voice", "mood", "declension", "conjugation", "voicing", "degree", "type"]

export const expectedFieldsForType: Record<string, string[]> = {
	verb:				["conjugation", "voicing", "voice", "tense", "mood", "quantity", "person"]
	,verb_stem:			["conjugation", "voicing", "voice", "tense"]
	,participle:		["conjugation", "voicing", "voice", "tense", "case", "quantity", "gender"]
	,participle_stem:	["conjugation", "voicing", "voice", "tense"]
	,gerundive:			["conjugation", "voicing", "case", "quantity", "gender"]
	,supine:			["conjugation", "voicing", "case"]
	,supine_stem:		["conjugation", "voicing"]
	,infinitive:		["conjugation", "voicing", "voice", "tense"]
	,imperative:		["conjugation", "voicing", "voice", "quantity", "tense", "person"]
	,gerund:			["conjugation", "voicing", "case"]
	,noun:				["declension", "case", "quantity", "gender"]
	,noun_stem:			["declension", "gender"]
	,adjective:			["declension", "case", "quantity", "gender", "degree"]
	,adjective_stem:	["declension", "degree"]
	,generatedAdverb:	["degree", "declension"]
}

export function checkValidity(parsing: Parsing, forceStemCheck: boolean = false) {
	if (!parsing.type) {
		console.error("desc.type undefined")
		return
	}
	if (parsing.type === "unknown") {
		return
	}

	if (parsing.isStem && !forceStemCheck) {
		return
	}

	const type = parsing.isStem ? parsing.type+"_stem" : parsing.type

	if (!expectedFieldsForType[type]) {
		console.error("type not in expectedFieldsForType table")
	}

	let expectedDefined = [...expectedFieldsForType[type], "isStem", "type"]
	for (let key of expectedDefined) {
		//@ts-ignore
		if (typeof parsing[key] !== (key === "isStem" ? "boolean" : "string")) {
			//@ts-ignore
			console.error(`Invalid type for <${type}>.${key}: ${typeof parsing[key]}`)
		}
	}

	let extraKeys = Object.keys(parsing).filter(key => !expectedDefined.includes(key) && key !== "alternateForm")
	if (extraKeys.length > 0) {
		console.error(`Shouldn't have ${extraKeys.join(", ")} on <${type}>.)`)
	}
}

export function stringifyParsing(parsing: Parsing) {
	checkValidity(parsing)
	if (parsing.type === "unknown") {
		return ""
	}
	let out = ""
	if (parsing.isStem) {
		out += "[stem]"
	}
	const appendName = ["person", "declension", "conjugation"]
	for (let key of standardOrdering) {
		//@ts-ignore
		let value: string = parsing[key]
		if (value !== undefined) {
			if (out.length !== 0) {
				out += " "
			}
			out += value
			if (appendName.includes(key)) {
				out += " "+key
			}
		}
	}
	if (parsing.alternateForm !== undefined) {
		out += ` (alternate form ${parsing.alternateForm})`
	}
	out = out.replace("irregular conjugation regular", "irregular")
	return out
}

export function shortStringifyParsing(parsing: Parsing) {
	checkValidity(parsing)
	if (parsing.type === "unknown") {
		return ""
	}
	let out = ""
	if (parsing.isStem) {
		out += "[stem]"
	}
	const ignoreKeys = ["declension", "conjugation", "voicing"]
	const appendName = {"person": "pers.", "declension": "decl.", "conjugation":"conj."}
	for (let key of standardOrdering) {
		if (ignoreKeys.includes(key)) {
			continue
		}
		//@ts-ignore
		let value: string = parsing[key]
		if (value !== undefined) {
			if (out.length !== 0) {
				out += " "
			}
			//@ts-ignore
			if (shortDescriptionStrings[key]) {
				//@ts-ignore
				value = shortDescriptionStrings[key][value]
			}
			out += value
			//@ts-ignore
			if (appendName[key]) {
				//@ts-ignore
				out += " "+appendName[key]
			}
		}
	}
	if (parsing.alternateForm !== undefined) {
		out += ` (alternate form ${parsing.alternateForm})`
	}
	return out
}

