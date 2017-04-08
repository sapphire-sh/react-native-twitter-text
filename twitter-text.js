'use strict';

import React, { Component } from 'react';
import {
	Linking,
	Text,
	View
} from 'react-native';

const twitter = require('twitter-text');

function clone(o) {
	var r = {};
	for (var k in o) {
		if (o.hasOwnProperty(k)) {
			r[k] = o[k];
		}
	}

	return r;
}

export default class TwitterText extends Component {
	_linkToUrl(entity, text, options) {
		var url = entity.url;
		var displayUrl = url;
		var linkText = twttr.txt.htmlEscape(displayUrl);

		// If the caller passed a urlEntities object (provided by a Twitter API
		// response with include_entities=true), we use that to render the display_url
		// for each URL instead of it's underlying t.co URL.
		var urlEntity = (options.urlEntities && options.urlEntities[url]) || entity;
		if (urlEntity.display_url) {
			linkText = twttr.txt.linkTextWithEntity(urlEntity, options);
		}

		var attrs = clone(options.htmlAttrs || {});

		if (!url.match(twttr.txt.regexen.urlHasProtocol)) {
			url = 'http://' + url;
		}
		attrs.href = url;

		if (options.targetBlank) {
			attrs.target = '_blank';
		}

		// set class only if urlClass is specified.
		if (options.urlClass) {
			attrs['class'] = options.urlClass;
		}

		// set target only if urlTarget is specified.
		if (options.urlTarget) {
			attrs.target = options.urlTarget;
		}

		if (!options.title && urlEntity.display_url) {
			attrs.title = urlEntity.expanded_url;
		}

		return this._linkToText(entity, linkText, attrs, options);
	}

	_linkToText(entity, text, attributes, options) {
		// if linkAttributeBlock is specified, call it to modify the attributes
		if (options.linkAttributeBlock) {
			options.linkAttributeBlock(entity, attributes);
		}
		// if linkTextBlock is specified, call it to get a new/modified link text
		if (options.linkTextBlock) {
			text = options.linkTextBlock(entity, text);
		}
		return (
			<Text onPress={() => this._onPress(attributes.href)}>{text}</Text>
		);
	}

	_onPress(link) {
		Linking.canOpenURL(link).then(supported => {
			if (supported) {
				Linking.openURL(link);
			} else {
				console.log('Don\'t know how to open URI: ' + link);
			}
		});
	}

	_linkToCashtag(entity, text, options) {
		var cashtag = twttr.txt.htmlEscape(entity.cashtag);
		var attrs = clone(options.htmlAttrs || {});
		attrs.href = options.cashtagUrlBase + cashtag;
		attrs.title = '$' + cashtag;
		attrs['class'] =  options.cashtagClass;
		if (options.targetBlank) {
			attrs.target = '_blank';
		}

		return this._linkToTextWithSymbol(entity, '$', cashtag, attrs, options);
	}

	_linkToHashtag(entity, text, options) {
		var hash = text.substring(entity.indices[0], entity.indices[0] + 1);
		var hashtag = twttr.txt.htmlEscape(entity.hashtag);
		var attrs = clone(options.htmlAttrs || {});
		attrs.href = options.hashtagUrlBase + hashtag;
		attrs.title = '#' + hashtag;
		attrs['class'] = options.hashtagClass;
		if (hashtag.charAt(0).match(twttr.txt.regexen.rtl_chars)){
			attrs['class'] += ' rtl';
		}
		if (options.targetBlank) {
			attrs.target = '_blank';
		}

		return this._linkToTextWithSymbol(entity, hash, hashtag, attrs, options);
	}

	_linkToMentionAndList(entity, text, options) {
		var at = text.substring(entity.indices[0], entity.indices[0] + 1);
		var user = twttr.txt.htmlEscape(entity.screenName);
		var slashListname = twttr.txt.htmlEscape(entity.listSlug);
		var isList = entity.listSlug && !options.suppressLists;
		var attrs = clone(options.htmlAttrs || {});
		attrs['class'] = (isList ? options.listClass : options.usernameClass);
		attrs.href = isList ? options.listUrlBase + user + slashListname : options.usernameUrlBase + user;
		if (!isList && !options.suppressDataScreenName) {
			attrs['data-screen-name'] = user;
		}
		if (options.targetBlank) {
			attrs.target = '_blank';
		}

		return this._linkToTextWithSymbol(entity, at, isList ? user + slashListname : user, attrs, options);
	}

	_linkToTextWithSymbol(entity, symbol, text, attributes, options) {
		var taggedSymbol = options.symbolTag ? '<' + options.symbolTag + '>' + symbol + '</'+ options.symbolTag + '>' : symbol;
		text = twttr.txt.htmlEscape(text);
		var taggedText = options.textWithSymbolTag ? '<' + options.textWithSymbolTag + '>' + text + '</'+ options.textWithSymbolTag + '>' : text;

		if (options.usernameIncludeSymbol || !symbol.match(twttr.txt.regexen.atSigns)) {
			return this._linkToText(entity, taggedSymbol + taggedText, attributes, options);
		} else {
			return (
				<View style={{flexDirection:'row', flexWrap:'wrap'}}>
					<Text>{ taggedSymbol }</Text>
					{ this._linkToText(entity, taggedText, attributes, options) }
				</View>
			);
		}
	};

	_autoLinkEntities(text, entities, options) {
		options = clone(options || {});

		options.hashtagUrlBase = options.hashtagUrlBase || 'https://twitter.com/#!/search?q=%23';
		options.cashtagUrlBase = options.cashtagUrlBase || 'https://twitter.com/#!/search?q=%24';
		options.usernameUrlBase = options.usernameUrlBase || 'https://twitter.com/';
		options.listUrlBase = options.listUrlBase || 'https://twitter.com/';
		options.htmlAttrs = twttr.txt.extractHtmlAttrsFromOptions(options);
		options.invisibleTagAttrs = options.invisibleTagAttrs || 'style="position:absolute;left:-9999px;"';

		// sort entities by start index
		entities.sort(function(a,b){ return a.indices[0] - b.indices[0]; });
		var beginIndex = 0;

		return (
			<View style={{flexDirection:'row', flexWrap:'wrap'}}>
				{
					entities.map((entity, i) => {
						let txt = text.substring(beginIndex, entity.indices[0]);
						let component;
						if (entity.url) {
							component = this._linkToUrl(entity, text, options);
						} else if (entity.hashtag) {
							component = this._linkToHashtag(entity, text, options);
						} else if (entity.screenName) {
							component = this._linkToMentionAndList(entity, text, options);
						} else if (entity.cashtag) {
							component = this._linkToCashtag(entity, text, options);
						}
						beginIndex = entity.indices[1];

						return (
							<View key={i} style={{flexDirection:'row', flexWrap:'wrap'}}>
								<Text>{txt}</Text>
								{ component }
							</View>
						);
					})
				}
				<Text>{text.substring(beginIndex, text.length)}</Text>
			</View>
		);
	}

	render() {
		const entities = twitter.extractEntitiesWithIndices(this.props.tweet.text, {extractUrlsWithoutProtocol: false});

		return (
			this._autoLinkEntities(this.props.tweet.text, entities, this.props.tweet.options)
		);
	}
};
