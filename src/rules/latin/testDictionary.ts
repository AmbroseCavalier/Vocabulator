/*
import {
	DerivationRoot,
	Dictionary,
	DictionaryWord,
	InversionFormProposal,
	Rule
} from "./dictionary";

// This section of naming inspired/copied by the similar typedefs in William Whittaker's Words
type WordType =
	| "verb"
	| "noun"
	| "adjective"
	| "generatedAdverb"
	| "participle"
	| "supine"
	| "infinitive"
	| "gerund"
	| "gerundive"
	| "imperative";
type Gender = "masc" | "fem" | "m/f" | "neuter";
type Declension = "1st" | "2nd" | "3rd" | "3rd I-stem" | "4th" | "5th";
type Conjugation = "1st" | "2nd" | "3rd" | "3rd I-stem" | "4th" | "esse-like";
type Mood = "indicative" | "subjunctive";
type Voicing = "regular" | "deponent" | "semideponent" | "perfdef";
type Voice = "active" | "passive";
type Tense =
	| "future"
	| "future perfect"
	| "present"
	| "imperfect"
	| "perfect"
	| "pluperfect";
type Degree = "positive" | "comparative" | "superlative";
type Case =
	| "nominative"
	| "vocative"
	| "genitive"
	| "dative"
	| "accusative"
	| "ablative"
	| "locative";
type Quantity = "singular" | "plural";
type Person = "1st" | "2nd" | "3rd";

const shortGenders: { [gen in Gender]: string } = {
	masc: "m.",
	"m/f": "m/f.",
	fem: "f.",
	neuter: "n."
};

const shortTypes: { [type in WordType]: string } = {
	verb: "v.",
	noun: "n.",
	adjective: "adj.",
	generatedAdverb: "adv.",
	participle: "part.",
	supine: "sup.",
	infinitive: "inf.",
	gerund: "grnd.",
	gerundive: "grndv.",
	imperative: "imp."
};

const shortTenses: { [tense in Tense]: string } = {
	future: "fut.",
	"future perfect": "fut. perf.",
	present: "pres.",
	imperfect: "imp.",
	perfect: "perf.",
	pluperfect: "pluperf."
};

const shortQuantities: { [quant in Quantity]: string } = {
	singular: "sg.",
	plural: "pl."
};

const shortCases: { [c in Case]: string } = {
	nominative: "nom.",
	vocative: "voc.",
	genitive: "gen.",
	dative: "dat.",
	accusative: "acc.",
	ablative: "abl.",
	locative: "loc."
};

const shortVoices: { [v in Voice]: string } = {
	active: "act.",
	passive: "pass."
};

const shortMoods: { [v in Mood]: string } = {
	indicative: "ind.",
	subjunctive: "subj."
};

const shortDescriptionStrings = {
	tense: shortTenses,
	quantity: shortQuantities,
	case: shortCases,
	gender: shortGenders,
	type: shortTypes,
	voice: shortVoices,
	mood: shortMoods
};

type WordDescription = {
	type?: WordType;
	gender?: Gender;
	declension?: Declension;
	conjugation?: Conjugation;
	mood?: Mood;
	voicing?: Voicing;
	voice?: Voice;
	tense?: Tense;
	degree?: Degree;
	case?: Case;
	quantity?: Quantity;
	person?: Person;
	isStem?: boolean;
	alternateForm?: number;
};

const dictionary = new Dictionary<WordDescription, RuleMetadata>();

const word = dictionary.addWord();
word.addRoot("port", {
	type: "verb",
	conjugation: "1st",
	isStem: true,
	tense: "present"
});
word.addRoot("portare", {
	type: "infinitive",
	conjugation: "1st",
	isStem: true,
	tense: "present"
});
word.addRoot("portau", {
	type: "verb",
	conjugation: "1st",
	isStem: true,
	tense: "perfect"
});

dictionary.addRule(
	new Rule(
		0,
		"-isse",
		() => true,
		(desc) => {
			const proposals = new Set<InversionFormProposal<WordDescription>>();
			if (desc.form.endsWith("isse")) {
				proposals.add([
					{ form: desc.form.substring(0, desc.form.length - 4) }
				]);
			}
			return proposals;
		},
		(step) => {},
		{}
	)
);

dictionary.addRule(
	new Rule(
		0,
		"-erunt",
		() => true,
		(desc) => {
			const proposals = new Set<InversionFormProposal<WordDescription>>();
			if (desc.form.endsWith("erunt")) {
				proposals.add([
					{ form: desc.form.substring(0, desc.form.length - 5) }
				]);
			}
			return proposals;
		},
		(step) => {},
		{}
	)
);

const syncopationRule = new Rule<WordDescription>(
	0,
	"syncopation",
	(step) => {
		const sources = step.sources;
		if (sources.length === 1) {
			const source = sources[0];

			//TODO check derivation root form 1st decl perfect etc
			if (
				source.form.includes("aue") ||
				source.form.includes("aui")
			) {
				return true;
			}
		}
		return false;
	},
	(desc) => {
		const proposals = new Set<InversionFormProposal<WordDescription>>();
		if (desc.form.includes("a")) {
			const lastIndex = desc.form.lastIndexOf("a");
			const newForm1 =
				desc.form.substring(0, lastIndex) +
				"aue" +
				desc.form.substring(lastIndex + 1);
			proposals.add([
				{
					form: newForm1,
					newRuleConstraints: new Set([
						{
							type: "rule",
							fn: (rule: Rule<WordDescription>) => {
								return rule !== syncopationRule
							}
						}
					])
				}
			]);

			const newForm2 =
				desc.form.substring(0, lastIndex) +
				"aui" +
				desc.form.substring(lastIndex + 1);
			proposals.add([
				{
					form: newForm2,
					newRuleConstraints: new Set([
						{
							type: "rule",
							fn: (rule: Rule<WordDescription>) => {
								return rule !== syncopationRule
							}
						}
					])
				}
			]);
		}
		return proposals;
	},
	(step) => {},
	{}
)
dictionary.addRule(
	syncopationRule
);

/*
const splittingRule = new Rule<WordDescription>(
	1,
	(step) => {
		return true
	},
	(desc) => {
		const proposals = new Set<InversionFormProposal<WordDescription>>();
		for (let i = 1; i<=desc.form.length-1; i++) {
			const before = desc.form.substring(0, i)
			const after = desc.form.substring(i)
			proposals.add([
				{
					form: before,
					newRuleConstraints: new Set([
						{
							type: "rule",
							fn: (rule: Rule<WordDescription>) => {
								return rule !== splittingRule
							}
						}
					])
				},{
					form: after,
					newRuleConstraints: new Set([
						{
							type: "rule",
							fn: (rule: Rule<WordDescription>) => {
								return rule !== splittingRule
							}
						}
					])
				}
			]);
		}
		return proposals;
	},
	(step) => {},
	(step) => {
		//explain
	}
)
dictionary.addRule(
	splittingRule
);
* /

type RuleMetadata = {

}

dictionary.addRule(
	new Rule(
		0,
		"u <-> v",
		() => true,
		(desc) => {
			const replaced = desc.form.replace(/v/g, "u")

			const proposals = new Set<InversionFormProposal<WordDescription, RuleMetadata>>();
			if (replaced !== desc.form) {
				proposals.add([
					{ form: replaced }
				]);
			}
			return proposals;
		},
		(step) => {},
		{}
	)
);

console.log(dictionary)
console.log(dictionary.lookup("portavisse"))
*/
