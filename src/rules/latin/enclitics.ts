import { Rule } from "../../lemmatizer/lemmatizer";
import { latinLemmatizer } from "./init";
import { LatinLemmatizerConfig } from "./types";

function addEnclitic(suffix: string, debugName: string, explanationHeading: string, explanationBodyHTML: string) {
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
							stemConstraints: new Set()
						}
					]
				]);
			}
			return null
			//TODO: nom sg suffix "itas"
		},
		metadata:{
			inParsingStr: "<any>",
			outParsingStr: "<any>",
			explanation: {
				heading: explanationHeading,
				htmlBody: explanationBodyHTML
			},
			usedForStemFinding: false
		},
		predecessorRuleConstraint: (thatRule) => !thatRule.metadata.outParsing || !thatRule.metadata.outParsing.isStem,
		shouldHaveRulePredecessors: true
	})
	latinLemmatizer.addRule(thisRule)
}

addEnclitic("ne", "-ne", "-ne", `The enclitic <i>-ne</i> can be added to the first word of a sentence
to mark it as a yes/no question. (<a href="https://dcc.dickinson.edu/grammar/latin/questions">More Information</a>)`)

addEnclitic("que", "-que", "-que", `The enclitic conjunction <i>-que</i> can be added to the second of two
connected words and acts as if <i>et</i> was placed between them.
(<a href="https://dcc.dickinson.edu/grammar/latin/uses-conjunctions">More Information</a>)`)

addEnclitic("ue", "-ve", "-ve", `The enclitic conjunction <i>-ve</i> can be added to the second of two
connected words and acts as if <i>aut</i> or <i>vel</i> was placed between them.
(<a href="https://en.wiktionary.org/wiki/-ve#Latin">More Information</a>)`)
