/**
regulars.ts

This file contains:

	- the TypeScript types for Parsings, RuleMetadata, table shapes, and dictionary entry objects
	- the declension and conjugation tables for the regular part of Latin declension system
	- the declaration of the singleton Lemmatizer instance
	- various functions to help organize the process of loading the tables into the lemmatizer
	  instance
	- various utilities for working with and formatting Parsing objects (e.g., making "short descriptions"
	  of parsings)

---------------
Example declension table:

iterateTable(caseQuantityTableShape, (caseAndQuantity, suffix) => {
	addSimpleSuffixRule({type: "noun", isStem: true, declension: "1st", gender: "m/f"}, suffix, {...caseAndQuantity, type:"noun", declension: "1st", gender: "m/f", isStem:false})
}, `
a
ae
ae
am
a

ae
arum
is
as
is
`)
 */

import { Rule, RuleConstraint, StemConstraint } from "../../lemmatizer/lemmatizer"
import { latinLemmatizer } from "./init"
import { Conjugation, Declension, Gender, getStemMetadata, LatinLemmatizerConfig, Parsing, ParsingKey, ParsingPermutationSet, stringifyParsing, Voicing } from "./types"

const transitionInvariantKeys = ["declension", "conjugation", "voicing"]

export const rulesWithOutputParsing = new Map<string, Set<Rule<LatinLemmatizerConfig>>>()

export function addSimpleSuffixRule(inWord: Parsing, suffix: string, outWord: Parsing) {
	for (const key of transitionInvariantKeys) {
		//@ts-ignore
		if (inWord[key] !== outWord[key]) {
			//@ts-ignore
			console.error(`transition invariant for ${key} violated: ${inWord[key]} -> ${outWord[key]}`)
		}
	}


	const newRuleConstraints: Set<RuleConstraint<LatinLemmatizerConfig>> = new Set([
		{type: "rule", fn: (rule, immediatelyDeeper) => {
			return rule !== thisRule && (!immediatelyDeeper || rule.metadata.outParsingStr === thisRule.metadata.inParsingStr)
		}}
	])
	const stemConstraints: Set<StemConstraint<LatinLemmatizerConfig>> = new Set([
		{
			type:"stem",
			fn: (stem) => {
				return stem.metadata.parsingStr === thisRule.metadata.inParsingStr
			},
			possibleMetadata: new Set([getStemMetadata(inWord)])
		}
	])

	const inDescStr = stringifyParsing(inWord)
	const outDescStr = stringifyParsing(outWord)

	const outWordData = getStemMetadata(outWord)
	const thisRule: Rule<LatinLemmatizerConfig> = new Rule<LatinLemmatizerConfig>({
		level:0,
		debugName:stringifyParsing(inWord)+" -> (+"+suffix+") -> "+stringifyParsing(outWord),
		verifyGeneration:()=>true,
		proposeReductions:(step)=>{
			if (step.form.endsWith(suffix)) {
				return new Set([[{
					form: step.form.substring(0, step.form.length-suffix.length)
					,newRuleConstraints
					,stemConstraints
				}]])
			}
			return null
		},
		addMetadata:(step)=>{
			step.metadata = outWordData
		},
		metadata:{
			inParsingStr: inDescStr
			,outParsingStr: outDescStr
			,outParsing: outWord
		},
		predecessorRuleConstraint:(thatRule)=>thatRule.metadata.outParsingStr === thisRule.metadata.inParsingStr,
	})

	if (!rulesWithOutputParsing.has(outDescStr)) {
		rulesWithOutputParsing.set(outDescStr, new Set())
	}
	rulesWithOutputParsing.get(outDescStr)!.add(thisRule)

	latinLemmatizer.addRule(thisRule)
}

export function iterateTable(varyingValues: Parsing[], handle: (partialParsing: Parsing, suffix: string) => void, rawSuffixesTable: string) {
	const splitSuffixes = rawSuffixesTable.trim().split(/\s+/)
	if (splitSuffixes.length !== varyingValues.length) {
		throw new Error("Lengths dont match")
	}

	for (let i = 0; i<splitSuffixes.length; i++) {
		const suffix = splitSuffixes[i]
		const partialParsing = varyingValues[i]
		handle(partialParsing, suffix)
	}
}

export function generateShapedTable(keyValues: ParsingPermutationSet, keyOrdering: ParsingKey[]): Parsing[] {
	if (keyOrdering.length !== Object.keys(keyValues).length) {
		throw new Error("Lengths don't match")
	}

	const counters = new Array(keyOrdering.length).fill(0)
	const descriptions = []
	while (true) {
		const desc: Parsing = Object.create(null)
		for (let i = 0; i<keyOrdering.length; i++) {
			const key = keyOrdering[i]
			const valueIndex = counters[i]
			const valueArr = keyValues[key]
			if (!valueArr) {
				throw new Error("unexpected state")
			}
			const value = valueArr[valueIndex]

			//@ts-ignore
			desc[key] = value
		}
		descriptions.push(desc)
		for (let i = 0; i<keyOrdering.length; i++) {
			const key = keyOrdering[i]
			const valueArr = keyValues[key]
			if (!valueArr) {
				throw new Error("unexpected state")
			}

			counters[i]++
			if (counters[i] >= valueArr.length) {
				//carry
				if (i === keyOrdering.length-1) {
					//done
					return descriptions
				}

				for (let j = i; j>=0; j--) {
					counters[j] = 0
				}
			} else {
				break //no carry needed
			}
		}
	}
}

function deponentize(inner: (partialParsing: Parsing, suffix: string, voicing: Voicing) => void) {
	return (partialParsing: Parsing, suffix: string): void => {
		const voicings: Voicing[] = ["regular", "deponent"]
		for (const voicing of voicings) {
			if (voicing === "deponent") {
				if (partialParsing.voice === "passive") {
					const shallowCopy: Parsing = {...partialParsing, voice:"active"}
					inner(shallowCopy, suffix, voicing)
				}
			} else {
				inner(partialParsing, suffix, voicing)
			}
		}
	}
}

const caseQuantityTableShape = generateShapedTable({
	case:["nominative", "genitive", "dative", "accusative", "ablative"]
	,quantity:["singular", "plural"]
}, ["case", "quantity"])

const personalNeuterTableShape = generateShapedTable({
	case:["nominative", "genitive", "dative", "accusative", "ablative"]
	,quantity:["singular", "plural"]
	,gender:["m/f", "neuter"]
}, ["gender","case", "quantity"])

const mascFemNeutTableShape = generateShapedTable({
	case:["nominative", "genitive", "dative", "accusative", "ablative"]
	,quantity:["singular", "plural"]
	,gender:["masc", "fem", "neuter"]
}, ["gender", "case", "quantity"])

const personalNeuter3rdDecTableShape: Parsing[] = [

	{gender: "m/f", case: "genitive", quantity: "singular", isStem: false}, {gender: "neuter", case: "genitive", quantity: "singular", isStem: false}
	,{gender: "m/f", case: "dative", quantity: "singular", isStem: false}, {gender: "neuter", case: "dative", quantity: "singular", isStem: false}
	,{gender: "m/f", case: "accusative", quantity: "singular", isStem: false}
	,{gender: "m/f", case: "ablative", quantity: "singular", isStem: false},{gender: "neuter", case: "ablative", quantity: "singular", isStem: false}

	,{gender: "m/f", case: "nominative", quantity: "plural", isStem: false},{gender: "neuter", case: "nominative", quantity: "plural", isStem: false}
	,{gender: "m/f", case: "genitive", quantity: "plural", isStem: false},{gender: "neuter", case: "genitive", quantity: "plural", isStem: false}
	,{gender: "m/f", case: "dative", quantity: "plural", isStem: false},{gender: "neuter", case: "dative", quantity: "plural", isStem: false}
	,{gender: "m/f", case: "accusative", quantity: "plural", isStem: false},{gender: "neuter", case: "accusative", quantity: "plural", isStem: false}
	,{gender: "m/f", case: "ablative", quantity: "plural", isStem: false},{gender: "neuter", case: "ablative", quantity: "plural", isStem: false}
]


const mascFemNeut3rdDecTableShape: Parsing[] = [

	{gender: "masc", case: "genitive", quantity: "singular", isStem: false}, {gender: "fem", case: "genitive", quantity: "singular", isStem: false}, {gender: "neuter", case: "genitive", quantity: "singular", isStem: false}
	,{gender: "masc", case: "dative", quantity: "singular", isStem: false}, {gender: "fem", case: "dative", quantity: "singular", isStem: false}, {gender: "neuter", case: "dative", quantity: "singular", isStem: false}
	,{gender: "masc", case: "accusative", quantity: "singular", isStem: false}, {gender: "fem", case: "accusative", quantity: "singular", isStem: false}
	,{gender: "masc", case: "ablative", quantity: "singular", isStem: false}, {gender: "fem", case: "ablative", quantity: "singular", isStem: false}, {gender: "neuter", case: "ablative", quantity: "singular", isStem: false}

	,{gender: "masc", case: "nominative", quantity: "plural", isStem: false},{gender: "fem", case: "nominative", quantity: "plural", isStem: false},{gender: "neuter", case: "nominative", quantity: "plural", isStem: false}
	,{gender: "masc", case: "genitive", quantity: "plural", isStem: false},{gender: "fem", case: "genitive", quantity: "plural", isStem: false},{gender: "neuter", case: "genitive", quantity: "plural", isStem: false}
	,{gender: "masc", case: "dative", quantity: "plural", isStem: false},{gender: "fem", case: "dative", quantity: "plural", isStem: false},{gender: "neuter", case: "dative", quantity: "plural", isStem: false}
	,{gender: "masc", case: "accusative", quantity: "plural", isStem: false},{gender: "fem", case: "accusative", quantity: "plural", isStem: false},{gender: "neuter", case: "accusative", quantity: "plural", isStem: false}
	,{gender: "masc", case: "ablative", quantity: "plural", isStem: false},{gender: "fem", case: "ablative", quantity: "plural", isStem: false},{gender: "neuter", case: "ablative", quantity: "plural", isStem: false}
]

// ===================== NOUNS =========================
iterateTable(caseQuantityTableShape, (caseAndQuantity, suffix) => {
	addSimpleSuffixRule({type: "noun", isStem: true, declension: "1st", gender: "m/f"}, suffix, {...caseAndQuantity, type:"noun", declension: "1st", gender: "m/f", isStem:false})
}, `
a
ae
ae
am
a

ae
arum
is
as
is
`)

iterateTable(personalNeuterTableShape, (caseGenderQuantity, suffix) => {
	if (suffix === "@") {
		return //nominative singular m/f isn't generated because it is not always -us (e.g., ager, puer, liber)
	}
	addSimpleSuffixRule({type: "noun", isStem: true, declension: "2nd", gender:caseGenderQuantity.gender}, suffix, {...caseGenderQuantity, declension: "2nd", type:"noun", isStem:false})
}, `
@	um
i	i
o	o
um	um
o	o

i		a
orum	orum
is		is
os		a
is		is
`)

const standard_us_a_um_table = `us a  um
i  ae i
o  ae o
um am um
o  a  o

i ae  a
orum arum orum
is is is
os as a
is is is`


iterateTable(personalNeuter3rdDecTableShape, (caseGenderQuantity, suffix) => {
	addSimpleSuffixRule({type: "noun", isStem: true, declension: "3rd", gender:caseGenderQuantity.gender}, suffix, {...caseGenderQuantity, declension: "3rd", type:"noun", isStem:false})
},`
is 		is
i 		i
em
e 		e

es		a
um		um
ibus	ibus
es		a
ibus	ibus
`)

addSimpleSuffixRule({type: "noun", isStem: true, declension: "3rd", gender:"neuter"}, "i", {gender:"neuter", quantity:"singular", case:"ablative", type:"noun", declension: "3rd", isStem:false, alternateForm: 1})

addSimpleSuffixRule({type: "noun", isStem: true, declension: "3rd", gender:"m/f"}, "ium", {gender:"m/f", quantity:"plural", case:"genitive", type:"noun", declension: "3rd", isStem:false, alternateForm: 1})
addSimpleSuffixRule({type: "noun", isStem: true, declension: "3rd", gender:"neuter"}, "ium", {gender:"neuter", quantity:"plural", case:"genitive", type:"noun", declension: "3rd", isStem:false, alternateForm: 1})

addSimpleSuffixRule({type: "noun", isStem: true, declension: "3rd", gender:"neuter"}, "ia", {gender:"neuter", quantity:"plural", case:"nominative", type:"noun", declension: "3rd", isStem:false, alternateForm: 1})
addSimpleSuffixRule({type: "noun", isStem: true, declension: "3rd", gender:"neuter"}, "ia", {gender:"neuter", quantity:"plural", case:"accusative", type:"noun", declension: "3rd", isStem:false, alternateForm: 1})


/* 3rd I-stem. Unused for the moment since dictionaries only sort of seem to distinguish. Instead the exceptions above are used

addTable(pnVarying3rdDec, (caseNumberGender, suffix) => {
	addTransition({type: "noun", isStem: true, declension: "3rd I-stem", gender:caseNumberGender.gender}, suffix, {...caseNumberGender, declension: "3rd I-stem", type:"noun", isStem:false})
	if (caseNumberGender.gender === "m/f" && caseNumberGender.case === "accusative" && caseNumberGender.quantity === "plural") {
		addTransition({type: "noun", isStem: true, declension: "3rd I-stem", gender:caseNumberGender.gender}, "es", {...caseNumberGender, declension: "3rd I-stem", type:"noun", isStem:false, alternateForm:1})
	}
},`
is 		is
i 		i
em
e 		i

es		ia
ium		ium
ibus	ibus
is		ia
ibus	ibus
`)
*/
iterateTable(personalNeuterTableShape, (caseGenderQuantity, suffix) => {
	addSimpleSuffixRule({type: "noun", isStem: true, declension: "4th", gender:caseGenderQuantity.gender}, suffix, {...caseGenderQuantity, declension: "4th", type:"noun", isStem:false})
}, `
us		u
us		us
ui		u
um		u
u		u

us		ua
uum		uum
ibus	ibus
us		ua
ibus	ibus
`)

iterateTable(caseQuantityTableShape, (caseQuantity, suffix) => {
	addSimpleSuffixRule({type: "noun", isStem: true, declension: "5th", gender: "m/f"}, suffix, {...caseQuantity, type:"noun", declension: "5th", gender: "m/f", isStem:false})
}, `
es
ei
ei
em
e

es
erum
ebus
es
ebus
`)

// ===================== ADJECTIVES =========================
const secondDeclensionAdjectiveStem: Parsing = {type:"adjective", isStem: true, declension:"2nd"}
const thirdDeclensionAdjectiveStem: Parsing = {type:"adjective", isStem: true, declension:"3rd"}
const adjectiveSuperlativeStem: Parsing = {type:"adjective", isStem: true, degree: "superlative"}

iterateTable(mascFemNeutTableShape, (caseGenderQuantity, suffix) => {
	if (caseGenderQuantity.gender === "masc" && caseGenderQuantity.quantity === "singular" && caseGenderQuantity.case === "nominative") {
		return //don't add a production for this because it is unpredictable (e.g., aeger, alter)
	}
	addSimpleSuffixRule(secondDeclensionAdjectiveStem, suffix, {...caseGenderQuantity, type:"adjective", isStem: false, declension:"2nd", degree:"positive"})
}, standard_us_a_um_table)

iterateTable(mascFemNeut3rdDecTableShape, (caseGenderQuantity, suffix) => {
	addSimpleSuffixRule(thirdDeclensionAdjectiveStem, suffix, {...caseGenderQuantity, declension: "3rd", type:"adjective", isStem:false, degree:"positive"})
	if (caseGenderQuantity.gender === "m/f" && caseGenderQuantity.case === "accusative" && caseGenderQuantity.quantity === "plural") {
		addSimpleSuffixRule(thirdDeclensionAdjectiveStem, "es", {...caseGenderQuantity, declension: "3rd", type:"adjective", isStem:false, degree:"positive", alternateForm:1})
	} else if (caseGenderQuantity.case === "ablative" && caseGenderQuantity.quantity === "singular") {
		addSimpleSuffixRule(thirdDeclensionAdjectiveStem, "e", {...caseGenderQuantity, declension: "3rd", type:"adjective", isStem:false, degree:"positive", alternateForm:1})
	}
},`
is		is 		is
i		i 		i
em		em
i		i 		i

es		es		ia
ium		ium		ium
ibus	ibus	ibus
is		is		ia
ibus	ibus	ibus
`)


iterateTable(personalNeuterTableShape, (caseGenderQuantity, suffix) => {
	const declensions: Declension[] = ["2nd", "3rd"]
	for (const declension of declensions) {
		addSimpleSuffixRule({type:"adjective", isStem:true, declension}, suffix, {...caseGenderQuantity, type:"adjective", isStem: false, declension, degree:"comparative"})
	}
}, `
ior		ius
ioris	ioris
iori	iori
iorem	ius
iore	iore

iores	iora
iorum	iorum
ioribus	ioribus
iores	iora
ioribus	ioribus
`)

for (const declension of ["2nd", "3rd"] as Declension[]) {
	addSimpleSuffixRule({type:"adjective", isStem:true, declension}, "issim", {...adjectiveSuperlativeStem, declension})
}

iterateTable(mascFemNeutTableShape, (caseGenderQuantity, suffix) => {
	const declensions: Declension[] = ["2nd", "3rd"]
	for (const declension of declensions) {
		addSimpleSuffixRule({...adjectiveSuperlativeStem, declension}, suffix, {...caseGenderQuantity, type:"adjective", isStem: false, declension, degree:"superlative"})
	}
}, standard_us_a_um_table)

// ===================== ADVERBS =========================

for (const declension of ["2nd", "3rd"] as Declension[]) {
	addSimpleSuffixRule({type:"adjective", isStem:true, declension}, "ius", {type:"generatedAdverb", declension, isStem:false, degree:"comparative"})
	addSimpleSuffixRule({type:"adjective", isStem:true, declension}, "issime", {type:"generatedAdverb", declension, isStem:false, degree:"superlative"})
}

// ===================== VERBS ===========================
const verbPresentStem: Parsing = {type: "verb", isStem: true, tense: "present"}
const verbPerfectStem: Parsing = {type: "verb", isStem: true, tense: "perfect"}
const verbPresentInfinitive: Parsing = {type: "infinitive", isStem: false, tense: "present", voice:"active"}
const verbPerfectInfinitive: Parsing = {type: "infinitive", isStem: false, tense: "perfect", voice:"active"}
const verbImperfectSubjunctiveStem: Parsing = {type: "verb", isStem: true, tense: "imperfect", mood: "subjunctive"}
const verbPluperfectSubjunctiveStem: Parsing = {type: "verb", isStem: true, tense: "perfect", mood: "subjunctive"}

const verbPresentSystem = generateShapedTable({
	conjugation:["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	,person:["1st", "2nd", "3rd"]
	,quantity:["singular", "plural"]
	,tense:["present", "imperfect", "future"]
	,voice:["active", "passive"]
}, ["conjugation", "person", "quantity", "tense","voice"])

iterateTable(verbPresentSystem, deponentize((conjPersNumTenseVoice, suffix, voicing) => {
	addSimpleSuffixRule({...verbPresentStem, conjugation: conjPersNumTenseVoice.conjugation, voicing}, suffix, {...conjPersNumTenseVoice, type:"verb", isStem: false, mood: "indicative", voicing})
}),`
${/*1st		2nd		3rd		3I		4th*/""}
	o		eo		o		io		io
	as		es		is		is		is
	at		et		it		it		it
	amus	emus	imus	imus	imus
	atis	etis	itis	itis	itis
	ant		ent		unt		iunt	iunt

	abam	ebam	ebam	iebam	iebam
	abas	ebas	ebas	iebas	iebas
	abat	ebat	ebat	iebat	iebat
	abamus	ebamus	ebamus	iebamus	iebamus
	abatis	ebatis	ebatis	iebatis iebatis
	abant	ebant	ebant	iebant	iebant

	abo		ebo		am		iam		iam
	abis	ebis	es		ies		ies
	abit	ebit	et		iet		iet
	abimus	ebimus	emus	iemus	iemus
	abitis	ebitis	etis	ietis	ietis
	abunt	ebunt	ent		ient	ient

${/*1st		2nd		3rd		3I		4th*/""}
	or		eor		or		ior		ior
	aris	eris	eris	eris	iris
	atur	etur	itur	itur	itur
	amur	emur	imur	imur	imur
	amini	emini	imini	imini	imini
	antur	entur	untur	iuntur	iuntur

	abar	ebar	ebar	iebar	iebar
	abaris	ebaris	ebaris	iebaris	iebaris
	abatur	ebatur	ebatur	iebatur	iebatur
	abamur	ebamur	ebamur	iebamur	iebamur
	abamini	ebamini	ebamini	iebamini	iebamini
	abantur	ebantur	ebantur	iebantur	iebantur

	abor	ebor	ar		iar		iar
	aberis	eberis	eris	ieris	ieris
	abitur	ebitur	etur	ietur	ietur
	abimur	ebimur	emur	iemur	iemur
	abimini	ebimini	emini	iemini	iemini
	abuntur	ebuntur	enter	ientur	ientur

`)

const verbPerfectSystemSingleConjugation = generateShapedTable({
	person:["1st", "2nd", "3rd"]
	,quantity:["singular", "plural"]
	,tense:["perfect", "pluperfect", "future perfect"]
}, ["person", "quantity", "tense"])

iterateTable(verbPerfectSystemSingleConjugation, deponentize((persNumTense, suffix, voicing) => {
	const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	for (const conjugation of conjugations) {
		addSimpleSuffixRule({...verbPerfectStem, conjugation, voicing}, suffix, {...persNumTense, conjugation, type:"verb", isStem:false, voice:"active", mood:"indicative", voicing})
	}
}),`
i
isti
it
imus
istis
erunt

eram
eras
erat
eramus
eratis
erant

ero
eris
erit
erimus
eritis
erint
`)

const verbSingleTense = generateShapedTable({
	conjugation:["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	,person:["1st", "2nd", "3rd"]
	,quantity:["singular", "plural"]
	,voice:["active", "passive"]
}, ["conjugation", "person", "quantity","voice"])

const verbSingleTenseSingleVoice = generateShapedTable({
	conjugation:["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	,person:["1st", "2nd", "3rd"]
	,quantity:["singular", "plural"]
}, ["conjugation", "person", "quantity"])

const verbSingleTenseSingleConjugation = generateShapedTable({
	person:["1st", "2nd", "3rd"]
	,quantity:["singular", "plural"]
	,voice:["active", "passive"]
}, ["person", "quantity","voice"])

const verbSingleTenseSingleConjugationSingleVoice = generateShapedTable({
	person:["1st", "2nd", "3rd"]
	,quantity:["singular", "plural"]
}, ["person", "quantity"])

iterateTable(verbSingleTense, deponentize((persNumConj, suffix, voicing) => {
	addSimpleSuffixRule({...verbPresentStem, conjugation: persNumConj.conjugation, voicing}, suffix, {...persNumConj, tense:"present", type:"verb", isStem:false, mood:"subjunctive", voicing})
}),
`
em		eam		am		iam		iam
es		eas		as		ias		ias
et		eat		at		iat		iat
emus	eamus	amus	iamus	iamus
etis	eatis	atis	iatis	iatis
ent		eant	ant		iant	iant

er		ear		ar		iar		iar
eris	earis	aris	iaris	iaris
etur	eatur	atur	iatur	iatur
emur	eamur	amur	iamur	iamur
emini	eamini	amini	iamini	iamini
entur	eantur	antur	iantur	iantur
`)


for (const conjugation of ["1st", "2nd", "3rd", "3rd I-stem", "4th"] as Conjugation[]) {
	addSimpleSuffixRule({...verbPresentInfinitive, conjugation, voicing:"regular"}, "", {...verbImperfectSubjunctiveStem, conjugation, voicing:"regular"})
	addSimpleSuffixRule({type:"imperative", person:"2nd", tense:"present", isStem:false, voicing:"deponent", voice:"active", quantity:"singular", conjugation}, "", {...verbImperfectSubjunctiveStem, conjugation, voicing:"deponent"})

	addSimpleSuffixRule({...verbPerfectInfinitive, conjugation, voicing:"regular"}, "", {...verbPluperfectSubjunctiveStem, conjugation, voicing:"regular"})
	addSimpleSuffixRule({...verbPerfectStem, conjugation, voicing:"deponent"}, "isse", {...verbPluperfectSubjunctiveStem, conjugation, voicing:"deponent"})
}

iterateTable(verbSingleTenseSingleConjugation, deponentize((persNum, suffix, voicing) => {
	const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	for (const conjugation of conjugations) {
		addSimpleSuffixRule({...verbImperfectSubjunctiveStem, conjugation, voicing}, suffix, {...persNum, conjugation, type:"verb", tense:"imperfect", isStem:false, mood:"subjunctive", voicing})
	}
}),
`
m
s
t
mus
tis
nt

r
ris
tur
mur
mini
ntur
`)

iterateTable(verbSingleTenseSingleConjugationSingleVoice, deponentize((persNum, suffix, voicing) => {
	const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	for (const conjugation of conjugations) {
		addSimpleSuffixRule({...verbPerfectStem, conjugation, voicing}, suffix, {...persNum, conjugation, isStem:false, type:"verb", mood:"subjunctive", tense:"perfect", voice:"active", voicing})
	}
}),
`
erim
eris
erit
erimus
eritis
erint
`)

iterateTable(verbSingleTenseSingleConjugationSingleVoice, deponentize((persNum, suffix, voicing) => {
	const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	for (const conjugation of conjugations) {
		addSimpleSuffixRule({...verbPluperfectSubjunctiveStem, conjugation, voicing}, suffix, {...persNum, conjugation, type:"verb", isStem:false, mood:"subjunctive", tense:"pluperfect", voice:"active", voicing})
	}
}),`
m
s
t
mus
tis
nt
`)



iterateTable(generateShapedTable({
	conjugation:["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	,voice:["active", "passive"]
}, ["conjugation", "voice"]), deponentize((conjVoice, suffix, voicing) => {
	addSimpleSuffixRule({...verbPresentStem, conjugation:conjVoice.conjugation, voicing}, suffix, {...conjVoice, tense:"present", type:"infinitive", isStem:false, voicing})
}),`
${/*1st		2nd		3rd		3I		4th*/""}
	are		ere		ere		ere		ire
	ari		eri		i		i		iri
`)

for (const conjugation of ["1st", "2nd", "3rd", "3rd I-stem", "4th"] as Conjugation[]) {
	addSimpleSuffixRule({...verbPerfectStem, conjugation, voicing:"regular"}, "isse", {...verbPerfectInfinitive, conjugation, voicing:"regular"})
}

iterateTable(generateShapedTable({
	conjugation:["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	,quantity:["singular", "plural"]
	,voice:["active", "passive"]
	,tense:["present", "future"]
	,person:["2nd", "3rd"]
}, ["conjugation", "person", "quantity", "voice", "tense"]), deponentize((conjNumVoiceTensePers, suffix, voicing) => {
	if (suffix === "@") {
		return
	}
	addSimpleSuffixRule({...verbPresentStem, conjugation:conjNumVoiceTensePers.conjugation, voicing}, suffix, {...conjNumVoiceTensePers, type:"imperative", isStem:false, voicing})
}), `
${/*1st		2nd		3rd		3I		4th*/""}
${/*present singular active*/""}
	a		e		e		e		i
	@		@		@		@		@
${/*present plural active*/""}
	ate		ete		ite		ite		ite
	@		@		@		@		@
${/*present singular passive*/""}
	are		ere		ere		ere		ire
	@		@		@		@		@
${/*present plural passive*/""}
	amini	emini	imini	imini	imini
	@		@		@		@		@

${/*future singular active*/""}
	a		eto		ito		ito		ito
	ato		eto		ito		ito		ito
${/*future plural active*/""}
	ate		etote	itote	itote	itote
	anto	ento	unto	iunto	iunto
${/*future singular passive*/""}
	ator	etor	itor	itor	itor
	ator	etor	itor	itor	itor
${/*future plural passive*/""}
	@		@		@		@		@
	antor	entor	untor	iuntor	iuntor


`)

const verbPerfectParticipleStem: Parsing = {type: "participle", tense:"perfect", isStem: true}

iterateTable(generateShapedTable({
	case:["accusative","ablative"]
}, ["case"]), (case_, suffix) => {
	const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	for (const conjugation of conjugations) {
		addSimpleSuffixRule({...verbPerfectParticipleStem, conjugation, voicing:"regular"}, suffix, {...case_, conjugation, type:"supine", isStem:false, voicing:"regular"})
	}
}, `
um
u
`)

const verbPresentActiveParticipleStem: Parsing = {type: "participle", isStem: true, tense: "present", voice:"active"}
iterateTable(generateShapedTable({
	conjugation: ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
	,case: ["nominative", "genitive"]
}, ["conjugation", "case"]), (conjCase, suffix) => {
	const voicings: Voicing[] = ["regular", "deponent"]
	for (const voicing of voicings) {
		if (conjCase.case === "nominative") {
			const genders: Gender[] = ["m/f", "neuter"]
			for (const gender of genders) {
				addSimpleSuffixRule({...verbPresentStem, conjugation:conjCase.conjugation, voicing}, suffix, {type:"participle", conjugation:conjCase.conjugation, isStem:false, tense:"present", voice:"active", voicing, case:"nominative", quantity:"singular", gender})
			}
		} else {
			addSimpleSuffixRule({...verbPresentStem, conjugation:conjCase.conjugation, voicing}, suffix, {type:"participle", conjugation:conjCase.conjugation, isStem:true, tense:"present", voice:"active", voicing})
		}
	}
}, `
${/*1st		2nd		3rd		3I		4th*/""}
	ans		ens		ens		iens	iens
	ant		ent		ent		ient	ient ${/* <-- note these are just stems, not the actual genitive.*/""}
`)

iterateTable(personalNeuter3rdDecTableShape, (caseGenderNumber, suffix) => {
	const voicings: Voicing[] = ["regular", "deponent"]
	for (const voicing of voicings) {
		const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
		for (const conjugation of conjugations) {
			addSimpleSuffixRule({...verbPresentActiveParticipleStem, voicing, conjugation}, suffix, {...caseGenderNumber, voicing, conjugation, type:"participle", isStem:false, tense:"present", voice:"active"})
			if (caseGenderNumber.gender === "m/f" && caseGenderNumber.case === "accusative" && caseGenderNumber.quantity === "plural") {
				addSimpleSuffixRule({...verbPresentActiveParticipleStem, voicing, conjugation}, "es", {...caseGenderNumber, voicing, conjugation, type:"participle", isStem:false, tense:"present", voice:"active", alternateForm:1})
			}
			if (caseGenderNumber.case === "ablative" && caseGenderNumber.quantity === "singular") {
				addSimpleSuffixRule({...verbPresentActiveParticipleStem, voicing, conjugation}, "e", {...caseGenderNumber, voicing, conjugation, type:"participle", isStem:false, tense:"present", voice:"active", alternateForm:1})
			}
		}
	}
},`
is 		is
i 		i
em
i 		i

es		ia
ium		ium
ibus	ibus
is		ia
ibus	ibus
`)


iterateTable(mascFemNeutTableShape, (caseNumberGender, suffix) => {
	const voicings: Voicing[] = ["regular", "deponent"]
	for (const voicing of voicings) {
		const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
		for (const conjugation of conjugations) {
			addSimpleSuffixRule({...verbPerfectParticipleStem, conjugation, voicing}, suffix, {...caseNumberGender, conjugation, type:"participle", voice:(voicing === "regular" ? "passive" : "active"), tense:"perfect", isStem:false, voicing})
		}
	}
}, standard_us_a_um_table)


const verbFutureActiveStem: Parsing = {type: "participle", tense:"future", isStem: true, voice:"active"}
for (const voicing of ["regular", "deponent"] as Voicing[]) {
	for (const conjugation of ["1st", "2nd", "3rd", "3rd I-stem", "4th"] as Conjugation[]) {
		addSimpleSuffixRule({...verbPerfectParticipleStem, conjugation, voicing}, "ur", {...verbFutureActiveStem, conjugation, voicing})
	}
}

iterateTable(mascFemNeutTableShape, (caseNumberGender, suffix) => {
	const voicings: Voicing[] = ["regular", "deponent"]
	for (const voicing of voicings) {
		const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
		for (const conjugation of conjugations) {
			addSimpleSuffixRule({...verbFutureActiveStem, conjugation, voicing}, suffix, {...caseNumberGender, conjugation, voicing, type:"participle", voice:"active", tense:"future", isStem:false})
		}
	}
}, standard_us_a_um_table)

const verbGerundStem: Parsing = {type: "gerund", isStem: true}
iterateTable(generateShapedTable({conjugation:["1st", "2nd", "3rd", "3rd I-stem", "4th"]}, ["conjugation"]), (caseGenderNumber, suffix) => {
	const voicings: Voicing[] = ["regular", "deponent"]
	for (const voicing of voicings) {
		addSimpleSuffixRule({...verbPresentStem, conjugation:caseGenderNumber.conjugation, voicing}, suffix, {...caseGenderNumber, ...verbGerundStem, voicing})
	}
},`
${/*1st		2nd		3rd		3I		4th*/""}
	and		end		end		iend	iend
`)

//Gerund
iterateTable(generateShapedTable({
	case:["genitive", "dative", "accusative", "ablative"]
}, ["case"]), (case_, suffix) => {
	const voicings: Voicing[] = ["regular", "deponent"]
	for (const voicing of voicings) {
		const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
		for (const conjugation of conjugations) {
			addSimpleSuffixRule({...verbGerundStem, conjugation, voicing}, suffix, {...case_, conjugation, voicing, type:"gerund", isStem:false})
		}
	}
}, `
i
o
um
o
`)

//Gerundive
iterateTable(mascFemNeutTableShape, (caseNumberGender, suffix) => {
	const voicings: Voicing[] = ["regular", "deponent"]
	for (const voicing of voicings) {
		const conjugations: Conjugation[] = ["1st", "2nd", "3rd", "3rd I-stem", "4th"]
		for (const conjugation of conjugations) {
			addSimpleSuffixRule({...verbGerundStem, conjugation, voicing}, suffix, {...caseNumberGender, conjugation, type:"gerundive", isStem:false, voicing})
		}
	}
}, standard_us_a_um_table)
