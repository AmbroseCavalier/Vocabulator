import rawText from "./consolatioLatin.js"
const rawLines = rawText.split("\n")

const out: [string, string][] = []

let currentBook = 1
let lastNumber: number | undefined = undefined
let lastNumberType: string | undefined = undefined
let sectionAccumulator = ""

function extractLines(str: string) {
	const lines: string[] = []
	const matcher = /\d+/g
	let lastIndex = 0
	let lastNum: number = 0

	function write(num: number, str: string) {
		lines[num-1] = str
	}

	while (true) {
		const match = matcher.exec(str)
		if (!match) {
			break
		}
		let between = str.substring(lastIndex, match.index).trim()
		const num = parseInt(match[0])
		if (between) {
			write(lastNum, between)
		}
		lastNum = num
		lastIndex = matcher.lastIndex
	}
	let between = str.substring(lastIndex).trim()
	if (between) {
		write(lastNum, between)
	}
	return lines
}


function formatRomanNumeral(n: number) {
	n = Math.floor(n)
	if (n < 1 || n > 3000) {
		throw new Error("out of bounds")
	}

	const chars = "ivxlcdm!!!"

	function mulRomanBy10(roman: string, power: number) {
		return roman.split("").map(char => chars[chars.indexOf(char)+2*power]).join("")
	}


	let basicSequence = `
i
ii
iii
iv
v
vi
vii
viii
ix
x
	`.trim().split("\n")


	let str = n.toString(10)
	let out = ""
	for (let i = 0; i<str.length; i++) {
		let digit = str[i]
		if (digit === "0") {
			continue
		}
		let power = str.length-1-i
		let roman = mulRomanBy10(basicSequence[parseInt(digit)-1], power)
		out += roman
	}
	return out
}

function emit() {
	const lines = extractLines(sectionAccumulator)
	for (let i = 0; i<lines.length; i++) {
		let loc = ""
		let bookRoman = formatRomanNumeral(currentBook).toUpperCase()
		loc += bookRoman
		if (lastNumberType === "prosa") {
			loc += ", "+lastNumber
		} else if (lastNumberType === "metrum") {
			loc += ", m. "+formatRomanNumeral(lastNumber ?? 1).toUpperCase()
		}
		loc += ", "+(i+1)
		out.push([loc, lines[i]])
	}
	sectionAccumulator = ""
}

for (let i = 0; i<rawLines.length; i++) {
	let line = rawLines[i]
	line = line.trim()
	let number
	let numberType
	if (line.startsWith("Prosa")) {
		number = parseInt(line.substring(6))
		numberType = "prosa"
	} else if (line.startsWith("Metrum")) {
		number = parseInt(line.substring(7))
		numberType = "metrum"
	} else {
		sectionAccumulator += line+"\n"
		continue
	}
	if (number) {
		if (lastNumber) {
			emit()
		}
		if (lastNumber) {
			if (number < lastNumber) {
				if (number === 1) { //book reset
					currentBook++
					lastNumberType = undefined
				} else {
					console.warn("Near line "+i+": number !== 1 < lastNumber")
				}
			} else if (number === lastNumber) {
				if (lastNumberType === numberType) {
					console.warn("Near line "+i+": Duplication?")
				}
			} else if (number > lastNumber+1) {
				console.warn("Near line "+i+": Skip?")
			}

			if (numberType === lastNumberType) {
				console.warn("Near line "+i+": Skip metrum or prosa?")
			}
		}
		lastNumber = number
		lastNumberType = numberType
	}
}
emit()

export default out
