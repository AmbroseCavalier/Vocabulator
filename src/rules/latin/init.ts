import {
	Stem,
	Lemmatizer,
	ReductionProposalSegment,
	Rule,
	RuleConstraint,
	StemConstraint
} from "../../lemmatizer/lemmatizer";
import { LatinLemmatizerConfig } from "./types";



export const latinLemmatizer = new Lemmatizer<LatinLemmatizerConfig>()
latinLemmatizer.addStringNormalizer(s => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/v/g, "u").replace(/j/g, "i"))


latinLemmatizer.addGeneralResultsConstraint(result => result.metadata?.parsing.isStem !== true)


