import { Headword } from "../../lemmatizer/lemmatizer"
import { latinLemmatizer } from "./init"
import { generateShapedTable, iterateTable } from "./regulars"
import { checkValidity, getStemMetadata, LatinLemmatizerConfig, Parsing } from "./types"


const irregularsMap = new Map<string, {
	sanityChecks: string[],
	word: Headword<LatinLemmatizerConfig>
}>()

export function findIrregular(id: string, fullLatin: string): null | Headword<LatinLemmatizerConfig> {
	if (fullLatin.includes("volo")) {
	//	console.log("lookup: ",{id, fullLatin})
	}
	if (irregularsMap.has(id)) {
		const {sanityChecks, word} = irregularsMap.get(id)!
		for (const check of sanityChecks) {
			if (!fullLatin.includes(check)) {
				console.log({word, sanityChecks, fullLatin})
				console.warn("Sanity check failed, possible out-of-phase ids.")
				return null
			}
		}
		return word
	}
	return null
}

function addIrregular(id: string, sanityChecks: string[], word: Headword<LatinLemmatizerConfig>) {
	irregularsMap.set(id, {sanityChecks, word})
}
const verbIrregularPresent = generateShapedTable({
	conjugation:["irregular"]
	,person:["1st", "2nd", "3rd"]
	,quantity:["singular", "plural"]
	,tense:["present"]
}, ["conjugation", "person", "quantity", "tense"])

const verbIrregularImperfect = generateShapedTable({
	conjugation:["irregular"]
	,person:["1st", "2nd", "3rd"]
	,quantity:["singular", "plural"]
	,tense:["present"]
}, ["conjugation", "person", "quantity", "tense"])
{
	const volo = latinLemmatizer.addWord()
	addIrregular("39059", ["volo", "velle", "volui"], volo)


	iterateTable(verbIrregularPresent, (varied, form) => {
		const parsing: Parsing = {type:"verb", voicing: "regular", voice:"active", isStem: false, mood:"indicative", ...varied}
		checkValidity(parsing)
		volo.addStem(form, getStemMetadata(parsing))
	}, `
	volo
	vis
	vult
	volumus
	vultis
	volunt
	`)

	iterateTable(verbIrregularPresent, (varied, form) => {
		const parsing: Parsing = {type:"verb", voicing: "regular", voice:"active", isStem: false, mood:"subjunctive", ...varied}
		checkValidity(parsing)
		volo.addStem(form, getStemMetadata(parsing))
	}, `
	velim
	velis
	velit
	velimus
	velitis
	velint
	`)

	const presentStem = volo.addStem("vol", getStemMetadata({
		type:"verb",
		conjugation: "3rd",
		tense: "present",
		voicing: "regular",
		isStem: true
	}))
	presentStem.addGenerationConstraint((step) => {
		const parsing = step.metadata?.parsing
		if (parsing) {
			if (parsing.voice === "active") {
				if (parsing.type === "verb") {
					if (parsing.mood === "indicative") {
						if (parsing.tense === "future" || parsing.tense === "imperfect") {
							return true
						}
					}
				}
			}
		}
		return false
	})


	iterateTable(verbIrregularImperfect, (varied, form) => {
		const parsing: Parsing = {type:"verb", voicing: "regular", voice:"active", isStem: false, mood:"subjunctive", ...varied}
		checkValidity(parsing)
		volo.addStem(form, getStemMetadata(parsing))
	}, `
	vellem
	velles
	vellet
	vellemus
	velletis
	vellent
	`)

	volo.addStem("volu", getStemMetadata({
		type:"verb",
		conjugation:"3rd",
		tense:"perfect",
		voicing:"regular",
		isStem:true
	}))
}

