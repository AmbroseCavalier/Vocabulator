//@ts-ignore
window.DEBUG = false

declare var DEBUG: boolean

type DictionaryGenericParams = {
	HeadwordMetadata: unknown,
	StemMetadata: unknown,
	RuleMetadata: unknown,
	GenerationMetadata: unknown
}

/**
 *  Represents a single headword in the dictionary, possibly with multiple stems.
 */
export class Headword<P extends DictionaryGenericParams> {
	/**
	 * The dictionary this word is a part of.
	 */
	readonly lemmatizer: Lemmatizer<P>

	/**
	 * The various stems which should all map to this dictionary entry.
	 */
	readonly stems: Set<Stem<P>>

	/**
	 * Information associated with this word which is not used by the morphological analyzer, such
	 * as English definitions.
	 *
	 * The morphological analyzer does not make any use of this property, and even the structure of
	 * this property can be chosen by consumers of the `Lemmatizer` class by using the generic type
	 * parameter "WordMetadata".
	 */
	metadata: P["HeadwordMetadata"] | undefined

	constructor(lemmatizer: Lemmatizer<P>, stems: Set<Stem<P>>, metadata?: P["HeadwordMetadata"] | undefined) {
		this.lemmatizer = lemmatizer
		this.stems = stems
		this.metadata = metadata
	}

	addStem(stem: Stem<P>): Stem<P>
	addStem(form: string, metadata: P["StemMetadata"]): Stem<P>
	addStem(form: string | Stem<P>, metadata?: P["StemMetadata"]): Stem<P> {
		let stem: Stem<P>
		if (form instanceof Stem) {
			stem = form
			if (stem.headword !== this) {
				throw new Error("Tried to add a stem which is not a stem of this word")
			}
		} else {
			form = this.lemmatizer.normalize(form)

			stem = new Stem(this, form, metadata, new Set())
		}

		if (!this.lemmatizer.stemsByForm.has(stem.form)) {
			this.lemmatizer.stemsByForm.set(stem.form, new Set())
		}
		this.lemmatizer.stemsByForm.get(stem.form)!.add(stem)

		this.stems.add(stem)
		return stem
	}
}

/**
 * Represents a single stem of some entry. All morphological analysis attempts to work back from
 * a surface form to one of these `Stem` objects.
 */
export class Stem<P extends DictionaryGenericParams> {
	/**
	 * The headword this stem is a part of.
	 */
	readonly headword: Headword<P>

	/**
	 * The literal characters which compose the stem.
	 */
	readonly form: string

	/**
	 * The data associated with this stem which is defined by the users of the `Lemmatizer` class.
	 * This is often used for storing the parsing of the stem.
	 */
	readonly metadata: P["StemMetadata"]

	/**
	 * Validation functions which constrain what can be produced from this stem.
	 */
	readonly generationConstraints: Set<GenerationChecker<P>>

	constructor(word: Headword<P>, form: string, metadata: P["StemMetadata"], generationConstraints: Set<GenerationChecker<P>>) {
		this.headword = word
		this.form = form
		this.metadata = metadata
		this.generationConstraints = generationConstraints
	}

	addGenerationConstraint(fn: GenerationChecker<P>) {
		this.generationConstraints.add(fn)
	}

	verifyForward(step: GenerationStep<P>) {
		for (const constraint of this.generationConstraints) {
			if (!constraint(step)) {
				return false
			}
		}
		return true
	}
}

export class Reduction<P extends DictionaryGenericParams> {
	parentStep: AnalysisStep<P>
	segments: (AnalysisStep<P> | Stem<P>)[]
	rule: Rule<P>

	constructor(parentStep: AnalysisStep<P>, rule: Rule<P>, sources: (AnalysisStep<P> | Stem<P>)[]) {
		this.parentStep = parentStep
		this.rule = rule
		this.segments = sources
	}

	findStems(allRules: Set<Rule<P>>, principalPartsGen?: PrincipalPartsStemGenerateParams<P>): boolean {
		if (!this.segments) {
			throw new Error("Unexpected state")
		}

		for (const source of this.segments) {
			if (source instanceof AnalysisStep) {
				const foundAnyStems = source.findStems(allRules, this.rule.precomputedAllowedPredecessorRules, principalPartsGen)
				if (!foundAnyStems) {
					return false
				}
			}
		}
		return true
	}
}

export type StemConstraint<P extends DictionaryGenericParams> = {
	type: "stem"
	fn: (stem: Stem<P>) => boolean
	possibleMetadata?: Set<P["StemMetadata"]>
}
export type RuleConstraint<P extends DictionaryGenericParams> = {
	type:"rule"
	fn: (rule: Rule<P>, immediatelyDeeper: boolean) => boolean,
	precomputedAllowedRules?: Set<Rule<P>>
}

let recursionCounter = 0

type PrincipalPartsStemGenerateParams<P extends DictionaryGenericParams> = {
	word: Headword<P>
}

export class AnalysisStep<P extends DictionaryGenericParams> {
	readonly lemmatizer: Lemmatizer<P>

	readonly forward: AnalysisStep<P> | null

	// Reduction paths which reach back eventually to stems. Note that these may fail in the forward
	// verification pass.
	readonly reductions: Set<Reduction<P>>

	readonly form: string

	readonly ownRuleConstraints: Set<RuleConstraint<P>>

	readonly ruleValidityCache: Map<Rule<P>, boolean>

	constructor(lemmatizer: Lemmatizer<P>, forward: AnalysisStep<P> | null, form: string, ruleConstraints: Set<RuleConstraint<P>>) {
		this.lemmatizer = lemmatizer
		this.forward = forward
		this.form = form
		this.reductions = new Set()
		this.ownRuleConstraints = ruleConstraints

		this.ruleValidityCache = new Map()
	}

	findStems(allRules: Set<Rule<P>>, rules?: Set<Rule<P>> | null | undefined, principalPartsGen?: PrincipalPartsStemGenerateParams<P>): boolean {
		recursionCounter++
		if (recursionCounter > 10000) {
			console.warn("Recursion limit reached")
			return false
		}

		const groupID = recursionCounter+ " trying to reduce: "+this.form
		if (DEBUG) {
			console.group(groupID)
		}

		// Iterate over all the rules which might allow us to get closer to a stem from here
		for (const rule of (rules ?? allRules)) {
			if (!this.ruleMeetsConstraints(rule)) {
				continue
			}
			// Ask each rule to propose possible precursor forms which might have resulted in this
			// form.
			const reductionProposals = rule.proposeReductions(this)
			if (reductionProposals && reductionProposals.size > 0) {
				if (DEBUG) {
					console.group("trying rule: "+rule.debugName)
				}
				if (DEBUG) {
					console.log(`got ${reductionProposals.size} reduction proposals
${Array.from(reductionProposals).map(entry => entry.map(e => e.form).join(",")).join("; ")}
(${rule.debugName})
${this.form}`)
				}

				// If anything proposes a form which is the same as this form, and doesn't set any
				// new constraints on what rules can be used in future steps, it will likely result
				// in an infinite loop. There's probably a mistake in the rule definitions if
				// this gets triggered.
				if (Array.from(reductionProposals).some(segments => segments.some(({form, newRuleConstraints}) => form === this.form && (!newRuleConstraints || newRuleConstraints.size === 0)))) {
					console.log(rule)
					throw new Error("Likely cyclical rule")
				}

				// Each proposal is a list of segments. This is to allow rules which split a form
				// into multiple sub-forms which map to separate stems.
				for (const segments of reductionProposals) {
					// Caches the result of generateSourcesPossibilites(i)
					const cache = new Map<number, (AnalysisStep<P> | Stem<P>)[][]>()

					// Each segment of a proposal represents a form. But this form might be from
					// either a stem or the result of some yet deeper application of rules.
					//
					// This function generates the different combinations of stem/derived form for
					// each of the segments of the proposal. It only generates the combinations
					// after and including segment index `startI`. This allows it to call itself
					// to simplify the algorithm.
					//
					// The result is an array of arrays, because each combination is an
					// (AnalysisStep<P> | Stem<P>)[] (corresponding to the array of segments), and
					// this generates all combinations.
					const generateSourcesPossibilites = (startI: number): (AnalysisStep<P> | Stem<P>)[][] => {
						if (startI >= segments.length) {
							return [[]]
						}

						// The combinations are deterministic based on `startI`, and its fine for
						// the `AnalysisStep` objects generated by this function to be reused in
						// different combination arrays, so we can cache the results of this
						// function and save performance.
						if (cache.has(startI)) {
							return cache.get(startI)!
						}


						// We'll recurse to take care of the combinations after this segment index.
						const furtherPossibilities = generateSourcesPossibilites(startI+1)

						// Create an array to hold all the different possible combinations
						const combinations: (AnalysisStep<P> | Stem<P>)[][] = []

						// Get the proposed segment at this index
						const segment: ReductionProposalSegment<P> = segments[startI]

						// There are two possible ways the form in this segment could have been
						// produced: 1. it could be a stem in the lemmatizer, or 2. it could be
						// a form which results from the application of one or more levels of
						// rules from a stem.
						//
						// These two possibilities are handled in the two blocks below

						// In this block we add the combinations which result from trying to find
						// a stem which matches the form in this segment.
						{
							const stems = principalPartsGen ? this.lemmatizer.proposePrincipalPartsStems(principalPartsGen.word, segment.form, segment.stemConstraints) : this.lemmatizer.findStems(segment.form, segment.stemConstraints)

							for (const stem of stems) {
								for (const possibility of furtherPossibilities) {
									combinations.push([stem, ...possibility])
								}
							}
						}

						// In this block we add the combinations which result from adding more
						// analysis steps to try more rules on this form.
						{
							const step = new AnalysisStep(this.lemmatizer, this, segment.form, segment.newRuleConstraints)
							for (const possibility of furtherPossibilities) {
								combinations.push([step, ...possibility])
							}
						}
						cache.set(startI, combinations)
						return combinations
					}

					const sourceTypeCombinations = generateSourcesPossibilites(0)
					if (DEBUG) {
						console.log("sourceTypeCombinations", sourceTypeCombinations)
					}

					for (const combination of sourceTypeCombinations) {
						const link = new Reduction(this, rule, combination)
						const foundReductionPathForAllSegments = link.findStems(allRules, principalPartsGen)
						if (foundReductionPathForAllSegments) {
							this.reductions.add(link)
						}
					}
				}
				if (DEBUG) {
					console.groupEnd()
				}
			}
		}

		if (DEBUG) {
			console.groupEnd()
		}
		return this.reductions.size > 0
	}

	/**
	 * Look over all the reductions from this AnalysisStep and check that they are valid.
	 *
	 * This method assumes .findStems() has already been called for this AnalysisStep instance.
	 */
	getVerifiedGenerationPaths(): Set<GenerationStep<P>> {
		if (DEBUG) {
			console.log("trying to get valid derivations for", this.form, this)
		}
		const verifiedGenerationPaths = new Set<GenerationStep<P>>()
		for (const reduction of this.reductions) {
			if (DEBUG) {
				console.log("trying reduction", reduction)
			}

			const cache = new Map<number, (GenerationStep<P> | Stem<P>)[][]>()

			// If a segment of an reduction is a stem, there is of course only one tree from stems
			// which can generate it and thus only one `GenerationStep` which results from that
			// segment. But if a segment of an reduction is not a Stem but another AnalysisStep,
			// that step might have multiple reductions from multiple rules and thus multiple
			// resulting GenerationSteps representing the possible trees which can generate the
			// form at that step. To generate all the possible trees to generate the form at this
			// AnalysisStep, we must apply a permutation procedure.
			const permuteSegmentGenerationPaths = (startI: number): (GenerationStep<P> | Stem<P>)[][]  => {
				if (startI >= reduction.segments.length) {
					return [[]]
				}
				if (cache.has(startI)) {
					return cache.get(startI)!
				}

				const permutations: (GenerationStep<P> | Stem<P>)[][] = []
				const segment = reduction.segments[startI]
				const furtherPermutations = permuteSegmentGenerationPaths(startI+1)
				if (segment instanceof Stem) {
					for (const permutation of furtherPermutations) {
						permutations.push([segment, ...permutation])
					}
				} else {
					const subderivations = segment.getVerifiedGenerationPaths()
					for (const derivation of subderivations) {
						for (const permutation of furtherPermutations) {
							permutations.push([derivation, ...permutation])
						}
					}
				}

				cache.set(startI, permutations)
				return permutations
			}

			const generationPermutations = permuteSegmentGenerationPaths(0)

			if (DEBUG) {
				console.log("got source arr options", generationPermutations)
			}

			possibilitiesLoop:
			for (const candidateSegmentGenerationPaths of generationPermutations) {
				const step = new GenerationStep(candidateSegmentGenerationPaths, this.form, reduction.rule)
				step.rule.addMetadata?.(step)
				for (const source of step.sources) {
					if (source instanceof Stem) {
						if (!source.verifyForward(step)) {
							continue possibilitiesLoop
						}
					}
				}
				if (step.rule.verifyGeneration(step)) {
					verifiedGenerationPaths.add(step)
				} else {
					if (DEBUG) {
						console.log(this.form+": forward verification failed", step)
					}
				}
			}
		}
		return verifiedGenerationPaths
	}

	ruleMeetsConstraints(rule: Rule<P>, upRecursed = false): boolean {
		if (this.ruleValidityCache.has(rule)) {
			return this.ruleValidityCache.get(rule)!
		}

		if (this.forward) {
			if (!this.forward.ruleMeetsConstraints(rule, true)) {
				this.ruleValidityCache.set(rule, false)
				return false
			}
		}

		for (const constraint of this.ownRuleConstraints) {
			const ok = constraint.precomputedAllowedRules ? constraint.precomputedAllowedRules.has(rule) : constraint.fn(rule, !upRecursed)
			if (!ok) {
				this.ruleValidityCache.set(rule, false)
				return false
			}
		}

		this.ruleValidityCache.set(rule, true)
		return true
	}
}

export class GenerationStep<P extends DictionaryGenericParams> {
	sources: (GenerationStep<P> | Stem<P>)[]
	metadata: P["GenerationMetadata"] | null
	form: string
	rule: Rule<P>

	constructor(sources: (GenerationStep<P> | Stem<P>)[], form: string, rule: Rule<P>) {
		this.sources = sources
		this.metadata = null
		this.form = form
		this.rule = rule
	}
}

export type GenerationChecker<P extends DictionaryGenericParams> = (step: GenerationStep<P>) => boolean

/**
 * Represents a proposed intermediate or stem form. These objects are generated by rules.
 */
export type ReductionProposalSegment<P extends DictionaryGenericParams> = {
	/** The literal characters of the proposed form.
	 */
	form: string,

	/**
	 * Predicates which constrain which rules can be used for later steps in analysis process.
	 *
	 * These are applied for ALL later reductions.
	 */
	newRuleConstraints: Set<RuleConstraint<P>>

	/**
	 * Predicates which constrain the stems which might match this form.
	 *
	 * These are applied ONLY to the root search for this form at this level
	 */
	stemConstraints: Set<StemConstraint<P>>
}

export type ReductionProposal<P extends DictionaryGenericParams> = ReductionProposalSegment<P>[]

export type ReductionProposalGenerator<P extends DictionaryGenericParams> = (step: AnalysisStep<P>) => Set<ReductionProposal<P>> | null

export class Rule<P extends DictionaryGenericParams> {
	lemmatizer: Lemmatizer<P> | null = null

	level: number //stage of rule. 0 always tried, 1 only tried if no results from 0, 2 only tried if no results from 1, etc.

	debugName: string

	verifyGeneration: GenerationChecker<P>
	proposeReductions: ReductionProposalGenerator<P>

	metadata: P["RuleMetadata"]

	addMetadata?: (step: GenerationStep<P>)=>void

	predecessorRuleConstraint?: (rule: Rule<P>) => boolean
	shouldHaveRulePredecessors?: boolean

	precomputedAllowedPredecessorRules: Set<Rule<P>> | null = null

	constructor({level, debugName, verifyGeneration, proposeReductions, addMetadata, metadata, predecessorRuleConstraint, shouldHaveRulePredecessors}: {
		level: number,
		debugName: string,
		verifyGeneration: GenerationChecker<P>,
		proposeReductions: ReductionProposalGenerator<P>,
		addMetadata?: (step: GenerationStep<P>) => void,
		metadata: P["RuleMetadata"],
		predecessorRuleConstraint?: (rule: Rule<P>)=>boolean,
		shouldHaveRulePredecessors?: boolean
	}) {
		this.level = level
		this.debugName = debugName
		this.verifyGeneration = verifyGeneration
		this.proposeReductions = proposeReductions
		this.metadata = metadata
		this.addMetadata = addMetadata
		this.predecessorRuleConstraint = predecessorRuleConstraint
		this.shouldHaveRulePredecessors = shouldHaveRulePredecessors
	}

	computeAllowedPredecessorRules() {
		if (!this.lemmatizer) {
			throw new Error("Unexpected state")
		}
		if (!this.predecessorRuleConstraint) {
			return
		}
		this.precomputedAllowedPredecessorRules = new Set()
		for (const rule of this.lemmatizer.rules) {
			if (this.predecessorRuleConstraint(rule)) {
				this.precomputedAllowedPredecessorRules.add(rule)
			}
		}
		if (this.shouldHaveRulePredecessors === true && this.precomputedAllowedPredecessorRules.size === 0) {
			console.warn("No valid predecessor rules found for "+this.debugName)
		}
	}
}

export class Lemmatizer<P extends DictionaryGenericParams> {
	/**
	 * Functions to do basic string normalization. (e.g., for a Latin lemmatizer you might add
	 * input normalizers to replace all v's with u, and all i's with j)
	 *
	 * These normalization functions are applied to BOTH the user input AND the stems from the
	 * dictionary.
	 */
	normalizers: Set<(str: string) => string> = new Set()
	words: Set<Headword<P>> = new Set()

	rules: Set<Rule<P>> = new Set()
	rulesAtOrBelowLevel: Set<Rule<P>>[] = []

	stemsByForm: Map<string, Set<Stem<P>>> = new Map()

	generalResultsConstraints: Set<(result: Stem<P> | GenerationStep<P>)=>boolean> = new Set()

	isRuleSetupDone: boolean = false

	constructor() {

	}

	addStringNormalizer(fn: (str: string) => string) {
		this.normalizers.add(fn)
	}

	normalize(str: string): string {
		for (const fn of this.normalizers) {
			str = fn(str)
		}
		return str
	}

	addWord(word?: Headword<P>): Headword<P> {
		if (!word) {
			word = new Headword(this, new Set())
		}
		this.words.add(word)
		return word
	}

	addRule(rule: Rule<P>) {
		if (this.isRuleSetupDone) {
			throw new Error("Can't add rules after .finishRuleSetup() has been called.")
		}

		rule.lemmatizer = this
		this.rules.add(rule)
	}

	finishRuleSetup() {
		this.isRuleSetupDone = true

		let maxLevel = 0
		for (const rule of this.rules) {
			maxLevel = Math.max(maxLevel, rule.level)
			rule.computeAllowedPredecessorRules()
		}

		for (const rule of this.rules) {
			for (let level = rule.level; level<=maxLevel; level++) {
				if (!this.rulesAtOrBelowLevel[level]) {
					this.rulesAtOrBelowLevel[level] = new Set()
				}
				this.rulesAtOrBelowLevel[level]!.add(rule)
			}
		}

	}

	addGeneralResultsConstraint(fn: (result: Stem<P> | GenerationStep<P>) => boolean) {
		this.generalResultsConstraints.add(fn)
	}

	meetsGeneralResultsConstraints(result: Stem<P> | GenerationStep<P>): boolean {
		for (const filter of this.generalResultsConstraints) {
			if (!filter(result)) {
				return false
			}
		}
		return true
	}

	lookup(form: string): Set<GenerationStep<P> | Stem<P>> {
		if (!this.isRuleSetupDone) {
			throw new Error("Lookup before setup done")
		}

		form = this.normalize(form)

		if (DEBUG) {
			console.time("lookup "+form)
		}
		if (form.trim() === "") {
			if (DEBUG) {
				console.timeEnd("lookup "+form)
			}
			return new Set()
		}

		recursionCounter = 0


		for (const rulesAtLevel of this.rulesAtOrBelowLevel) {
			const out = this.lookupWithRules(rulesAtLevel, form)
			if (out.size !== 0) {
				if (DEBUG) {
					console.log("end recursionCounter =",recursionCounter)
					console.timeEnd("lookup "+form)
				}
				return out
			}
		}
		/*
		TEST RECURSION COUNTS

		claudere - 1047
		maestis - 894
		viridisque - 1080
		portavere - 1383
		vivere - 1387

		*/
		if (DEBUG) {
			console.log("end recursionCounter =",recursionCounter)
			console.timeEnd("lookup "+form)
		}
		return new Set()
	}

	findStemCandidatesFromPrincipalPart({word, form, directStemResultConstraint, ruleConstraint, resultingParsedFormCheck}: {
		word: Headword<P>,
		form: string,
		ruleConstraint: RuleConstraint<P>,
		directStemResultConstraint: StemConstraint<P>,
		resultingParsedFormCheck: (step: GenerationStep<P> | Stem<P>) => boolean
	}): Set<GenerationStep<P> | Stem<P>> {
		recursionCounter = 0

		form = this.normalize(form)

		const start = new AnalysisStep<P>(this, null, form, new Set([ruleConstraint]))
		start.findStems(this.rulesAtOrBelowLevel[0], ruleConstraint.precomputedAllowedRules ?? null, {
			word
		})

		const out = new Set<GenerationStep<P> | Stem<P>>()

		for (const resultingPrincipalPartParsing of start.getVerifiedGenerationPaths()) {
			if (this.meetsGeneralResultsConstraints(resultingPrincipalPartParsing)) {
				if (resultingParsedFormCheck(resultingPrincipalPartParsing)) {
					out.add(resultingPrincipalPartParsing)
				}
			}
		}

		const rawStems = this.proposePrincipalPartsStems(word, form, new Set([directStemResultConstraint]))

		rawStemsLoop:
		for (const stem of rawStems) {
			if (this.meetsGeneralResultsConstraints(stem)) {
				if (resultingParsedFormCheck(stem)) {
					out.add(stem)
				}
			}
		}
		return out
	}

	proposePrincipalPartsStems(word: Headword<P>, form: string, constraints: Set<StemConstraint<P>>): Set<Stem<P>> {
		let smallestPossibleMetadataSet: Set<P["StemMetadata"]> | null = null

		for (const c of constraints) {
			if (c.possibleMetadata) {
				if (!smallestPossibleMetadataSet || c.possibleMetadata.size < smallestPossibleMetadataSet.size) {
					smallestPossibleMetadataSet = c.possibleMetadata
				}
			}
		}

		if (!smallestPossibleMetadataSet) {
			return new Set()
		}
		const out = new Set<Stem<P>>()
		for (const metadata of smallestPossibleMetadataSet as Set<P["StemMetadata"]>) {
			const possibleStem = new Stem(word, form, metadata, new Set())
			out.add(possibleStem)
		}
		return out
	}

	private lookupWithRules(rules: Set<Rule<P>>, form: string): Set<GenerationStep<P> | Stem<P>> {
		if (DEBUG) {
			console.log("lookup with",rules)
		}
		const start = new AnalysisStep<P>(this, null, form, new Set())
		start.findStems(rules)
		if (DEBUG) {
			console.log("reduced to",start)
		}
		const out: Set<GenerationStep<P> | Stem<P>> = new Set()
		for (const result of start.getVerifiedGenerationPaths()) {
			if (this.meetsGeneralResultsConstraints(result)) {
				out.add(result)
			}
		}

		const rawStems = this.findStems(form, new Set())
		for (const stem of rawStems) {
			if (this.meetsGeneralResultsConstraints(stem)) {
				out.add(stem)
			}
		}
		if (DEBUG) {
			console.log("got paths",out)
		}
		return out
	}

	findStems(form: string, constraints: Set<StemConstraint<P>>): Set<Stem<P>> {
		const out: Set<Stem<P>> = new Set()
		const stems = this.stemsByForm.get(form)
		if (stems) {
			for (const stem of stems) {
				let ok = true

				for (const constraint of constraints) {
					if (!constraint.fn(stem)) {
						ok = false
						break
					}
				}

				if (ok) {
					out.add(stem)
				}
			}
		}
		if (DEBUG) {
			if (out.size > 0) {
				console.log("got stems", out)
			}
		}
		return out
	}
}
