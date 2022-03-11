import * as D from "dynein"

class CSSManager {
	private refs: Map<string, {count: number, el: HTMLStyleElement}>

	constructor() {
		this.refs = new Map()
	}

	add(styles: string) {
		if (!this.refs.get(styles)) {
			let el = document.createElement("style")
			//console.log("adding",styles)
			el.textContent = styles
			document.head.appendChild(el)
			this.refs.set(styles, {
				count:0
				,el
			})
		}
		this.refs.get(styles)!.count++
	}

	remove(styles: string) {
		const ref = this.refs.get(styles)
		if (ref) {
			ref.count--
			if (ref.count <= 0) {
				ref.el.remove()
				this.refs.delete(styles)
			}
		}
	}
}
const cssManager = new CSSManager()

function css({raw:rawStrings}: TemplateStringsArray,...exprs: any[]) {
	let len = Math.max(rawStrings.length,exprs.length)
	let joined = ""
	for (var i = 0; i<len; i++) {
		if (rawStrings.length > i) {
			joined += rawStrings[i]
		}
		if (exprs.length > i) {
			joined += exprs[i]
		}
	}

	cssManager.add(joined)
	D.onCleanup(()=>{
		cssManager.remove(joined)
	})
}


function replaceMacrons(str: string) {
	return str.replace(/[āă]/g, "a").replace(/[ĀĂ]/g, "A")
			  .replace(/[ĕē]/g, "e").replace(/[ĔĒ]/g, "E")
			  .replace(/[īĭ]/g, "i").replace(/[ĪĬ]/g, "I")
			  .replace(/[ōŏ]/g, "o").replace(/[ŌŎ]/g, "O")
			  .replace(/[ūŭ]/g, "u").replace(/[ŪŬ]/g, "U")
			  .replace(/æ/g,    "ae").replace(/Æ/g,   "AE")
}

function cosmeticFixUV(str: string) { //NOTE: this is just for ease of reading. It shouldn't effect parsing.
	return str.replace(/(?<=\b|[aeiou]|in|ad|con|sub|ob)u(?=[aeiou])/gi, "v")
			  .replace(/\bU(?=[aeiou])/g, "V")
}


function escapeRegExp(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function toSearchRegexp(str: string) {
	return new RegExp(str.split(/\s+/g).map(escapeRegExp).join("[\\s\\W]+"), "i")
}

function findWords(rawText: string, handleWord: (word: string)=>void, handleBetween: (between: string)=>void) {
	let reg = /[A-Za-z]+/g
	let lastWordEnd = 0
	const text = replaceMacrons(rawText)
	let match = reg.exec(text)
	while (match) {
		let between = text.substring(lastWordEnd,match.index)
		handleBetween(between)
		let word = match[0]
		handleWord(word)
		lastWordEnd = reg.lastIndex
		match = reg.exec(text)
	}
	handleBetween(text.substring(lastWordEnd))
}

let idCounter = 0
function makeID() {
	return "_id"+(idCounter++)
}

export { escapeRegExp, toSearchRegexp, cosmeticFixUV, replaceMacrons, css, findWords, makeID }
