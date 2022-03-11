interface WorkSearchResult {
	success: boolean
	htmlHeader?: string
	data: string
}

interface Work {
	readOriginal(location: string): WorkSearchResult
	locationFormatHint: string

	searchOriginal?: (text: string) => WorkSearchResult
	readTranslation?: (location: string) => string

	originalCredit: string
	translationCredit?: string
}

export type { Work, WorkSearchResult }
