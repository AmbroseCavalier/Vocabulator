import { GenerationStep, ReductionProposal, Rule, Stem } from "../../lemmatizer/lemmatizer";
import { latinLemmatizer } from "./init";
import { LatinLemmatizerConfig, Parsing, Tense } from "./types";


function searchSources(start: GenerationStep<LatinLemmatizerConfig> | Stem<LatinLemmatizerConfig>,
	pred: (src: GenerationStep<LatinLemmatizerConfig> | Stem<LatinLemmatizerConfig>) => any): GenerationStep<LatinLemmatizerConfig> | Stem<LatinLemmatizerConfig> | null {
	if (pred(start)) {
		return start
	} else {
		if (start instanceof Stem) {
			return null
		} else {
			return searchSources(start.sources[0], pred)
		}
	}
}

const syncopationExplanation = `See <a href="https://dcc.dickinson.edu/grammar/latin/peculiarities">Allen
and Greenough</a> and <a href="https://www.thelatinlibrary.com/101/contractions.pdf">The Latin Library</a>
for more information about syncopation.`

const perfectTenses: Tense[] = ["perfect", "pluperfect", "future perfect"]
{
	const possiblyReducedVowels = [/a/g, /e/g, /i/g, /o/g, /u/g]

	function isSyncopationCandidate(parsing: Parsing): boolean {
		return !parsing.isStem && !!parsing.tense && perfectTenses.includes(parsing.tense)
	}

	const thisRule = new Rule<LatinLemmatizerConfig>({
		level:0,
		debugName: "perfect syncopation",
		verifyGeneration:(step)=>{
			const perfStem = searchSources(step, stem => stem.metadata?.parsing.isStem === true
				&& stem.metadata.parsing.tense
				&& perfectTenses.includes(stem.metadata.parsing.tense))
			if (!perfStem) {
				//console.log("no perfstem")
				return false
			} else {
				//console.log("check perfstem", perfStem.form, perfStem)
				return perfStem.form.endsWith("u")
			}
		}, proposeReductions:(step) => {
			//console.log("trying syncopation reduce", step.form)
			const proposals = new Set<ReductionProposal<LatinLemmatizerConfig>>()
			for (const vowel of possiblyReducedVowels) {
				const matches = step.form.matchAll(vowel)

				for (const match of matches) {
					const endIndex = match.index!+match[0].length
					if (endIndex !== step.form.length) {
						for (const removedChars of ["ui", "ue", "u"]) {
							const replaced = step.form.substring(0, match.index!)+match[0]+removedChars+step.form.substring(endIndex)
							//console.log("Try replace", replaced)

							proposals.add([{
								form: replaced,
								newRuleConstraints: new Set(),
								stemConstraints: new Set([
									{
										type: "stem",
										fn: (stem) => isSyncopationCandidate(stem.metadata.parsing)
									}
								])
							}])
						}
					}
				}
			}
			return proposals
			//TODO: nom sg suffix "itas"
		},
		metadata:{
			inParsingStr:"<perf>",
			outParsingStr: "<syncopated perf>",
			explanation: {
				heading: (step) => {
					return `Syncopation: ${step.sources[0].form} → ${step.form}`
				},
				htmlBody: syncopationExplanation
			},
			usedForStemFinding: false
		},
		predecessorRuleConstraint: (thatRule) => thatRule.metadata.outParsingStr === "<general syncopation>" || (!!thatRule.metadata.outParsing && isSyncopationCandidate(thatRule.metadata.outParsing)),
		shouldHaveRulePredecessors: true
	})
	latinLemmatizer.addRule(thisRule)

}

// portaverunt -> portavere -> portare
{
	const possiblyReducedEndings: [string, string][] = [
		["ris", "re"],
		["erunt", "ere"]
	]

	function isSyncopationCandidate(parsing: Parsing): boolean {
		return !parsing.isStem && parsing.type === "verb"
	}
	const thisRule = new Rule<LatinLemmatizerConfig>({
		level:0,
		debugName: "general syncopation",
		verifyGeneration:(step)=>true, proposeReductions:(step) => {
			//console.log("trying general syncopation reduce", step.form)
			const proposals = new Set<ReductionProposal<LatinLemmatizerConfig>>()
			for (const [uncontracted, contracted] of possiblyReducedEndings) {
				if (step.form.endsWith(contracted)) {
					const replaced = step.form.substring(0, step.form.length-contracted.length)+uncontracted
					proposals.add([{
						form: replaced,
						newRuleConstraints: new Set(),
						stemConstraints: new Set([
							{
								type: "stem",
								fn: (stem) => isSyncopationCandidate(stem.metadata.parsing)
							}
						])
					}])
				}
			}
			return proposals
			//TODO: nom sg suffix "itas"
		},
		metadata:{
			inParsingStr:"<any>",
			outParsingStr: "<general syncopation>",
			explanation: {
				heading: (step) => {
					return `Syncopation: ${step.sources[0].form} → ${step.form}`
				},
				htmlBody: syncopationExplanation
			},
			usedForStemFinding: false
		},
		predecessorRuleConstraint: (thatRule) => !!thatRule.metadata.outParsing && isSyncopationCandidate(thatRule.metadata.outParsing),
		shouldHaveRulePredecessors: true
	})
	latinLemmatizer.addRule(thisRule)

}
