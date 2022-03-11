import * as D from "dynein"
import contentPageWrapper from "../components/contentPageWrapper.js"

export default function aboutPage() {
	contentPageWrapper(()=>{
		D.addHTML(`
		<h1 class="header">Help</h1>
		<p>The Vocabulator is a tool for reading Latin text. To get started, you need some text. You can use the built-in work by Boethius, or you can copy and paste into the “Custom” box.
		</p>
		<p>
		When you hover over a word, the Vocabulator will analyze it and show a parsing and definition taken from the William Whitaker’s Words’ dictionary.
		</p>
		<p>
		The other topics on this page cover how to work with other Latin texts, create printable vocabulary lists, and add your own entries to the dictionary.
		</p>
		<h1>1. Getting Text</h1>

		<p>There are lots of Latin texts online that can easily be copied and pasted into Vocabulator when the Work is set to “Custom”. The <a href="https://scaife.perseus.org/">Perseus Library</a> is an especially useful source.
		<p>
		Vocabulator currently has the full text of <i>The Consolation of Philosophy</i> built-in and to show specific text, you can enter a location or search for a word or phrase. To see multiple sections of Boethius at once, you can copy and paste into the Custom box.</p>
		<p>If you click on a word, it will “anchor” as the current word.</p>

		<h1>2. Creating a list of unknown vocabulary</h1>

		<p>The original purpose of the tool was to make it easier to create a personalized list of unknown vocabulary.</p>
		<ul><li>Every word starts on the “unknown” list.</li>
		<li>You can easily change a word from known to unknown and back by ctrl-clicking on the word, or by using the “Known” switch in the vocabulary area.</li>
		<li>Words that are known appear in the text in a light gray color.</li>
		<li>Vocabulator stores your personalized list on the computer you are using, and will use it for future texts.</li>
		</ul>

		<h1>3. Showing the Vocabulary List</h1>

		<p>You can list all the words in the passage that are unknown by switching the vocabulary display mode “Hover Only” to “For Print”.</p>
		<p>Clicking a Latin word in the list will highlight occurences in the passage. You can also ctrl-click on a Latin word in the list to add the source word to the known list.<p>
		<p>Clicking a word in the passage switches back to “Hover Only”.</p>

		<h1>4. Exporting the Vocabulary List</h1>
		<p>Pressing the “Print” button will open the browser print dialog. (Before you do this, you can set an informational header using the textbox, and set the font size and columns used.)</p>

		<h1>5. Adding custom notes</h1>

		<p>You can add notes and replace missing definitions with “Custom Results” box. When Vocabulator does not give any results, either it is an irregular or semi-irregular like <i>esse</i>, <i>ferre</i>, and their compounds (which Vocabulator does not parse properly yet), or it is not in the Whitaker’s Words dictionary. You can use Whitaker’s Words or another dictionary (like <a href="https://outils.biblissima.fr/en/collatinus-web/">Lewis and Short</a>) to get the proper parse and definition, and add it to your personal dictionary using the “Custom Results” box. (Reformat it to get the appearance you like.)</p>

		<h1>Other Problems</h1>

		<p>If you have any questions/comments/concerns/suggestions/bugs/etc. you can always talk to me in person or shoot me an email at <a href="mailto:ambrose.cavalier@christendom.edu">ambrose.cavalier@christendom.edu</a>.</p>
		`)
	})
}
