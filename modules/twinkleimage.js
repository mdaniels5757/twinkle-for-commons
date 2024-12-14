// <nowiki>

(function() {

/*
 ****************************************
 *** twinkleimage.js: Image CSD module
 ****************************************
 * Mode of invocation:     Tab ("DI")
 * Active on:              Local nonredirect file pages (not on Commons) - Only file pages that exist locally; Files that exist on Commons do not trigger this module.
 */

Twinkle.image = function twinkleimage() {
	if (mw.config.get('wgNamespaceNumber') === 6 && mw.config.get('wgArticleId') && !Morebits.isPageRedirect()) {
		Twinkle.addPortletLink(Twinkle.image.callback, 'DI', 'tw-di', 'Nominate file for delayed speedy deletion');
	}
};

Twinkle.image.callback = function twinkleimageCallback() {
	const Window = new Morebits.SimpleWindow(600, 330);
	Window.setTitle('File for dated speedy deletion');
	Window.setScriptName('Twinkle');
	Window.addFooterLink('Speedy deletion policy', 'COM:CSD#Files');
	Window.addFooterLink('Image prefs', 'COM:TW/PREF#image');
	Window.addFooterLink('Twinkle help', 'COM:TW');
	Window.addFooterLink('Give feedback', 'Commons talk:TW');

	const form = new Morebits.QuickForm(Twinkle.image.callback.evaluate);
	form.append({
		type: 'checkbox',
		list: [
			{
				label: 'Notify original uploader',
				value: 'notify',
				name: 'notify',
				tooltip: "Uncheck this if you are planning to make multiple nominations from the same user, and don't want to overload their talk page with too many notifications.",
				checked: Twinkle.getPref('notifyUserOnDeli')
			}
		]
	}
	);
	const field = form.append({
		type: 'field',
		label: 'Type of action wanted'
	});
	field.append({
		type: 'radio',
		name: 'type',
		event: Twinkle.image.callback.choice,
		list: [
			{
				label: 'No source (CSD F5)',
				value: 'no source',
				checked: true,
				tooltip: 'Image or media has no source information'
			},
			{
				label: 'No license (CSD F5)',
				value: 'no license',
				tooltip: 'Image or media does not have information on its copyright status'
			},
			{
				label: 'No evidence of permission (CSD F5)',
				value: 'no permission',
				tooltip: 'Image or media does not have proof that the author agreed to licence the file'
			}
		]
	});
	form.append({
		type: 'div',
		label: 'Work area',
		name: 'work_area'
	});
	form.append({ type: 'submit' });

	const result = form.render();
	Window.setContent(result);
	Window.display();

	// We must init the parameters
	const evt = document.createEvent('Event');
	evt.initEvent('change', true, true);
	result.type[0].dispatchEvent(evt);
};

Twinkle.image.callback.choice = function twinkleimageCallbackChoose(event) {
	const value = event.target.values;
	const root = event.target.form;
	const work_area = new Morebits.QuickForm.Element({
		type: 'div',
		name: 'work_area'
	});

	switch (value) {
		case 'no source':
			work_area.append({
				type: 'checkbox',
				list: [
					{
						name: 'derivative',
						label: 'Derivative work which lacks a source for incorporated works',
						tooltip: 'File is a derivative of one or more other works whose source is not specified'
					}
				]
			});
			break;
		case 'no license':
			break;
		case 'no permission':
			break;
		default:
			break;
	}

	root.replaceChild(work_area.render(), $(root).find('div[name="work_area"]')[0]);
};

Twinkle.image.callback.evaluate = function twinkleimageCallbackEvaluate(event) {

	const input = Morebits.QuickForm.getInputData(event.target);
	if (input.replacement) {
		input.replacement = (new RegExp('^' + Morebits.namespaceRegex(6) + ':', 'i').test(input.replacement) ? '' : 'File:') + input.replacement;
	}

	let csdcrit;
	switch (input.type) {
		case 'no source':
		case 'no license':
		case 'no permission':
			csdcrit = 'F5';
			break;
		default:
			throw new Error('Twinkle.image.callback.evaluate: unknown criterion');
	}

	const lognomination = Twinkle.getPref('logSpeedyNominations') && !Twinkle.getPref('noLogOnSpeedyNomination').includes(csdcrit.toLowerCase());
	const templatename = input.derivative ? 'dw ' + input.type : input.type;

	const params = $.extend({
		templatename: templatename,
		derivative: input.derivative,
		normalized: csdcrit,
		lognomination: lognomination
	}, input);

	Morebits.SimpleWindow.setButtonsEnabled(false);
	Morebits.Status.init(event.target);

	Morebits.wiki.actionCompleted.redirect = mw.config.get('wgPageName');
	Morebits.wiki.actionCompleted.notice = 'Tagging complete';

	// Tagging image
	const wikipedia_page = new Morebits.wiki.Page(mw.config.get('wgPageName'), 'Tagging file with deletion tag');
	wikipedia_page.setCallbackParameters(params);
	wikipedia_page.load(Twinkle.image.callbacks.taggingImage);

	// Notifying uploader
	if (input.notify) {
		wikipedia_page.lookupCreation(Twinkle.image.callbacks.userNotification);
	} else {
		// add to CSD log if desired
		if (lognomination) {
			Twinkle.image.callbacks.addToLog(params, null);
		}
		// No auto-notification, display what was going to be added.
		const noteData = document.createElement('pre');
		noteData.appendChild(document.createTextNode('{{subst:di-' + templatename + '-notice|1=File:' + mw.config.get('wgTitle') + '}} ~~~~'));
		Morebits.Status.info('Notification', [ 'Following/similar data should be posted to the original uploader:', document.createElement('br'), noteData ]);
	}
};

Twinkle.image.callbacks = {
	taggingImage: function(pageobj) {
		const text = pageobj.getPageText();
		const params = pageobj.getCallbackParameters();

		var tag = '';
		switch (params.type) {
			case 'no license':
				tag = '{{subst:nld}}';
				break;
			case 'no source':
				if (params.derivative) {
					tag = '{{subst:dw-nsd}}';
				} else {
					tag = '{{subst:nsd}}';
				}
				break;
			case 'no permission':
				tag = '{{subst:npd}}';
				break;
			default:
				break; // doesn't matter
		}
		// tag += '|help=off}}\n';
		tag += '\n';

		pageobj.setPageText(tag + text);
		pageobj.setEditSummary('This file is up for deletion, per [[COM:CSD#' + params.normalized + '|CSD ' + params.normalized + ']] (' + params.type + ').');
		pageobj.setChangeTags(Twinkle.changeTags);
		pageobj.setWatchlist(Twinkle.getPref('deliWatchPage'));
		pageobj.setCreateOption('nocreate');
		pageobj.save();
	},
	userNotification: function(pageobj) {
		const params = pageobj.getCallbackParameters();
		const initialContrib = pageobj.getCreator();

		// disallow warning yourself
		if (initialContrib === mw.config.get('wgUserName')) {
			pageobj.getStatusElement().warn('You (' + initialContrib + ') created this page; skipping user notification');
		} else {
			const usertalkpage = new Morebits.wiki.Page('User talk:' + initialContrib, 'Notifying initial contributor (' + initialContrib + ')');
			let notifytext = '\n{{subst:di-' + params.templatename + '-notice|1=File:' + mw.config.get('wgTitle');
			notifytext += '}} ~~~~';
			usertalkpage.setAppendText(notifytext);
			usertalkpage.setEditSummary('Notification: tagging for deletion of [[:' + Morebits.pageNameNorm + ']].');
			usertalkpage.setChangeTags(Twinkle.changeTags);
			usertalkpage.setCreateOption('recreate');
			usertalkpage.setWatchlist(Twinkle.getPref('deliWatchUser'));
			usertalkpage.setFollowRedirect(true, false);
			usertalkpage.append();
		}

		// add this nomination to the user's userspace log, if the user has enabled it
		if (params.lognomination) {
			Twinkle.image.callbacks.addToLog(params, initialContrib);
		}
	},
	addToLog: function(params, initialContrib) {
		const usl = new Morebits.UserspaceLogger(Twinkle.getPref('speedyLogPageName'));
		usl.initialText =
			"This is a log of all [[WP:CSD|speedy deletion]] nominations made by this user using [[WP:TW|Twinkle]]'s CSD module.\n\n" +
			'If you no longer wish to keep this log, you can turn it off using the [[Wikipedia:Twinkle/Preferences|preferences panel]], and ' +
			'nominate this page for speedy deletion under [[WP:CSD#U1|CSD U1]].' +
			(Morebits.userIsSysop ? '\n\nThis log does not track outright speedy deletions made using Twinkle.' : '');

		const formatParamLog = function(normalize, csdparam, input) {
			if (normalize === 'F5' && csdparam === 'replacement') {
				input = '[[:' + input + ']]';
			}
			return ' {' + normalize + ' ' + csdparam + ': ' + input + '}';
		};

		let extraInfo = '';

		// If a logged file is deleted but exists on commons, the wikilink will be blue, so provide a link to the log
		const fileLogLink = ' ([{{fullurl:Special:Log|page=' + mw.util.wikiUrlencode(mw.config.get('wgPageName')) + '}} log])';

		let appendText = '# [[:' + Morebits.pageNameNorm + ']]' + fileLogLink + ': DI [[WP:CSD#' + params.normalized.toUpperCase() + '|CSD ' + params.normalized.toUpperCase() + ']] ({{tl|di-' + params.templatename + '}})';

		['reason', 'replacement', 'source'].forEach((item) => {
			if (params[item]) {
				extraInfo += formatParamLog(params.normalized.toUpperCase(), item, params[item]);
				return false;
			}
		});

		if (extraInfo) {
			appendText += '; additional information:' + extraInfo;
		}
		if (initialContrib) {
			appendText += '; notified {{user|1=' + initialContrib + '}}';
		}
		appendText += ' ~~~~~\n';

		const editsummary = 'Logging speedy deletion nomination of [[:' + Morebits.pageNameNorm + ']].';

		usl.changeTags = Twinkle.changeTags;
		usl.log(appendText, editsummary);
	}
};

Twinkle.addInitCallback(Twinkle.image, 'image');
}());

// </nowiki>
