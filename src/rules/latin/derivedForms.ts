import { Rule } from "../../lemmatizer/lemmatizer"
import { latinLemmatizer } from "./init"
import { checkValidity, RuleMetadata, stringifyParsing, Parsing, LatinLemmatizerConfig } from "./types"

function addDerivedForm({
	inputParsingFilter,
	suffix,
	resultParsing,
	inParsingStr,
	explanationHeading,
	explanationBodyHTML,
	debugName
}: {
	inputParsingFilter: (parsing: Parsing) => boolean,
	suffix: string,
	debugName: string,
	inParsingStr: string,
	explanationHeading: string,
	explanationBodyHTML: string,
	resultParsing: Parsing
}) {
	checkValidity(resultParsing, true)
	const thisRule = new Rule<LatinLemmatizerConfig>({
		level:0,
		debugName,
		verifyGeneration:()=>{
			return true
		}, proposeReductions:(step) => {
			if (step.form.endsWith(suffix)) {
				return new Set([
					[
						{
							form: step.form.substring(
								0,
								step.form.length - suffix.length
							),
							newRuleConstraints: new Set(),
							stemConstraints: new Set([
								{
									type: "stem",
									fn: (stem) => {
										return inputParsingFilter(
											stem.metadata.parsing
										);
									}
								}
							])
						}
					]
				]);
			}
			return null
			//TODO: nom sg suffix "itas"
		},
		metadata:{
			inParsingStr,
			outParsingStr: stringifyParsing(resultParsing),
			explanation: {
				heading: explanationHeading,
				htmlBody: explanationBodyHTML
			},
			usedForStemFinding: false
		},
		predecessorRuleConstraint: (thatRule) => !!thatRule.metadata.outParsing && inputParsingFilter(thatRule.metadata.outParsing),
		shouldHaveRulePredecessors: true
	})
	latinLemmatizer.addRule(thisRule)
}

function isAdjectiveStem(parsing: Parsing): boolean {
	return !!parsing.isStem && (parsing.type === "adjective" || parsing.type === "participle" || parsing.type === "gerund")
}

const itasExplanationHTML = `Adding <i>-itas</i> to an adjective turns it into a noun in Latin, much
like adding <i>-ness</i> in English. For example, <i>bonus</i> (stem <i>bon-</i>) +
<i>itas</i> = <i>bonitas, bonitatis, f.</i> = goodness. See
<a href="https://dcc.dickinson.edu/grammar/latin/derivation-nouns">Allen and Greenough</a> for more information and examples.`
addDerivedForm({
	inputParsingFilter: isAdjectiveStem,
	suffix: "itat",
	resultParsing: {
		type: "noun",
		declension: "3rd",
		gender: "m/f",
		isStem: true
	},
	inParsingStr: "<adj stem>",
	explanationHeading:  "+itas, -itatis",
	explanationBodyHTML: itasExplanationHTML,
	debugName: "adj -> +itas noun (stem)"
})
addDerivedForm({
	inputParsingFilter: isAdjectiveStem,
	suffix: "itas",
	resultParsing: {
		type: "noun",
		declension: "3rd",
		gender: "m/f",
		case: "nominative",
		quantity: "singular",
		isStem: false
	},
	inParsingStr: "<adj stem>",
	explanationHeading:  "+itas, -itatis",
	explanationBodyHTML: itasExplanationHTML,
	debugName: "adj -> +itas noun (stem)"
})

