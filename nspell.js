/* ==========================================================================
   Vendored nspell (MIT License, (c) Titus Wormer <https://wooorm.com>)
   https://github.com/wooorm/nspell -- version 2.1.5

   This is a browser-compatible, dependency-free bundle of nspell's
   CommonJS source, reassembled by hand into a single IIFE (no bundler
   available in this environment) so it can be loaded with a plain
   <script> tag, matching this project's existing vendoring pattern
   (see keyframes.js / color-scopes.js). Logic is unchanged from upstream
   except: (1) require('is-buffer') is replaced with a no-op check,
   since this project only ever passes plain strings (fetched as text),
   never Node Buffers; (2) CommonJS require/module.exports wiring is
   replaced with plain function references inside one closure.

   Exposes: window.NSpell(aff, dic) -> spell-checker instance with
   .correct(word), .suggest(word), .spell(word), .add/.remove/.personal,
   .dictionary(dic), .wordCharacters().
   ========================================================================== */
(function (global) {
    'use strict';

    function isBuffer() {
        // Browser context: we never pass Node Buffers, only strings.
        return false;
    }

    var push = [].push;

    // ---- util/rule-codes.js ----
    var NO_CODES = [];
    function ruleCodes(flags, value) {
        var index = 0;
        var result;
        if (!value) return NO_CODES;
        if (flags.FLAG === 'long') {
            result = new Array(Math.ceil(value.length / 2));
            while (index < value.length) {
                result[index / 2] = value.slice(index, index + 2);
                index += 2;
            }
            return result;
        }
        return value.split(flags.FLAG === 'num' ? ',' : '');
    }

    // ---- util/affix.js ----
    var alphabet = 'etaoinshrdlcumwfgypbvkjxqz'.split('');
    var whiteSpaceExpression = /\s+/;
    var defaultKeyboardLayout = [
        'qwertzuop', 'yxcvbnm', 'qaw', 'say', 'wse', 'dsx', 'sy', 'edr',
        'fdc', 'dx', 'rft', 'gfv', 'fc', 'tgz', 'hgb', 'gv', 'zhu', 'jhn',
        'hb', 'uji', 'kjm', 'jn', 'iko', 'lkm'
    ];

    function affixEnd(source) {
        return new RegExp(source + '$');
    }
    function affixStart(source) {
        return new RegExp('^' + source);
    }

    function affix(doc) {
        var rules = Object.create(null);
        var compoundRuleCodes = Object.create(null);
        var flags = Object.create(null);
        var replacementTable = [];
        var conversion = { in: [], out: [] };
        var compoundRules = [];
        var aff = doc.toString();
        var lines = [];
        var last = 0;
        var index = aff.indexOf('\n');
        var parts, line, ruleType, count, remove, add, source, entry, position, rule, value, offset, character;

        flags.KEY = [];

        function pushLine(l) {
            l = l.trim();
            if (l && l.charCodeAt(0) !== 35 /* # */) {
                lines.push(l);
            }
        }

        while (index > -1) {
            pushLine(aff.slice(last, index));
            last = index + 1;
            index = aff.indexOf('\n', last);
        }
        pushLine(aff.slice(last));

        index = -1;
        while (++index < lines.length) {
            line = lines[index];
            parts = line.split(whiteSpaceExpression);
            ruleType = parts[0];

            if (ruleType === 'REP') {
                count = index + parseInt(parts[1], 10);
                while (++index <= count) {
                    parts = lines[index].split(whiteSpaceExpression);
                    replacementTable.push([parts[1], parts[2]]);
                }
                index--;
            } else if (ruleType === 'ICONV' || ruleType === 'OCONV') {
                count = index + parseInt(parts[1], 10);
                entry = conversion[ruleType === 'ICONV' ? 'in' : 'out'];
                while (++index <= count) {
                    parts = lines[index].split(whiteSpaceExpression);
                    entry.push([new RegExp(parts[1], 'g'), parts[2]]);
                }
                index--;
            } else if (ruleType === 'COMPOUNDRULE') {
                count = index + parseInt(parts[1], 10);
                while (++index <= count) {
                    rule = lines[index].split(whiteSpaceExpression)[1];
                    position = -1;
                    compoundRules.push(rule);
                    while (++position < rule.length) {
                        compoundRuleCodes[rule.charAt(position)] = [];
                    }
                }
                index--;
            } else if (ruleType === 'PFX' || ruleType === 'SFX') {
                count = index + parseInt(parts[3], 10);
                rule = { type: ruleType, combineable: parts[2] === 'Y', entries: [] };
                rules[parts[1]] = rule;
                while (++index <= count) {
                    parts = lines[index].split(whiteSpaceExpression);
                    remove = parts[2];
                    add = parts[3].split('/');
                    source = parts[4];
                    entry = {
                        add: '', remove: '', match: '',
                        continuation: ruleCodes(flags, add[1])
                    };
                    if (add && add[0] !== '0') {
                        entry.add = add[0];
                    }
                    try {
                        if (remove !== '0') {
                            entry.remove = ruleType === 'SFX' ? affixEnd(remove) : remove;
                        }
                        if (source && source !== '.') {
                            entry.match = ruleType === 'SFX' ? affixEnd(source) : affixStart(source);
                        }
                    } catch (_) {
                        entry = null;
                    }
                    if (entry) {
                        rule.entries.push(entry);
                    }
                }
                index--;
            } else if (ruleType === 'TRY') {
                source = parts[1];
                offset = -1;
                value = [];
                while (++offset < source.length) {
                    character = source.charAt(offset);
                    if (character.toLowerCase() === character) {
                        value.push(character);
                    }
                }
                offset = -1;
                while (++offset < alphabet.length) {
                    if (source.indexOf(alphabet[offset]) < 0) {
                        value.push(alphabet[offset]);
                    }
                }
                flags[ruleType] = value;
            } else if (ruleType === 'KEY') {
                push.apply(flags[ruleType], parts[1].split('|'));
            } else if (ruleType === 'COMPOUNDMIN') {
                flags[ruleType] = Number(parts[1]);
            } else if (ruleType === 'ONLYINCOMPOUND') {
                flags[ruleType] = parts[1];
                compoundRuleCodes[parts[1]] = [];
            } else if (
                ruleType === 'FLAG' || ruleType === 'KEEPCASE' ||
                ruleType === 'NOSUGGEST' || ruleType === 'WORDCHARS'
            ) {
                flags[ruleType] = parts[1];
            } else {
                // Unknown/unsupported directives (e.g. CIRCUMFIX, MAP) are
                // stored but not specially interpreted, matching upstream
                // nspell's graceful-degradation behavior.
                flags[ruleType] = parts[1];
            }
        }

        if (isNaN(flags.COMPOUNDMIN)) {
            flags.COMPOUNDMIN = 3;
        }
        if (!flags.KEY.length) {
            flags.KEY = defaultKeyboardLayout;
        }
        if (!flags.TRY) {
            flags.TRY = alphabet.concat();
        }
        if (!flags.KEEPCASE) {
            flags.KEEPCASE = false;
        }

        return {
            compoundRuleCodes: compoundRuleCodes,
            replacementTable: replacementTable,
            conversion: conversion,
            compoundRules: compoundRules,
            rules: rules,
            flags: flags
        };
    }

    // ---- util/apply.js ----
    function applyRule(value, rule, rules, words) {
        var index = -1;
        var entry, next, continuationRule, continuation, position;
        while (++index < rule.entries.length) {
            entry = rule.entries[index];
            continuation = entry.continuation;
            position = -1;
            if (!entry.match || entry.match.test(value)) {
                next = entry.remove ? value.replace(entry.remove, '') : value;
                next = rule.type === 'SFX' ? next + entry.add : entry.add + next;
                words.push(next);
                if (continuation && continuation.length) {
                    while (++position < continuation.length) {
                        continuationRule = rules[continuation[position]];
                        if (continuationRule) {
                            applyRule(next, continuationRule, rules, words);
                        }
                    }
                }
            }
        }
        return words;
    }

    // ---- util/add.js ----
    var NO_RULES = [];
    function addRules(dict, word, rules) {
        var curr = dict[word];
        if (word in dict) {
            if (curr === NO_RULES) {
                dict[word] = rules.concat();
            } else {
                push.apply(curr, rules);
            }
        } else {
            dict[word] = rules.concat();
        }
    }
    function addToDict(dict, word, codes, options) {
        var position = -1;
        var rule, offset, subposition, suboffset, combined, newWords, otherNewWords;
        if (
            !('NEEDAFFIX' in options.flags) ||
            codes.indexOf(options.flags.NEEDAFFIX) < 0
        ) {
            addRules(dict, word, codes);
        }
        while (++position < codes.length) {
            rule = options.rules[codes[position]];
            if (codes[position] in options.compoundRuleCodes) {
                options.compoundRuleCodes[codes[position]].push(word);
            }
            if (rule) {
                newWords = applyRule(word, rule, options.rules, []);
                offset = -1;
                while (++offset < newWords.length) {
                    if (!(newWords[offset] in dict)) {
                        dict[newWords[offset]] = NO_RULES;
                    }
                    if (rule.combineable) {
                        subposition = position;
                        while (++subposition < codes.length) {
                            combined = options.rules[codes[subposition]];
                            if (combined && combined.combineable && rule.type !== combined.type) {
                                otherNewWords = applyRule(newWords[offset], combined, options.rules, []);
                                suboffset = -1;
                                while (++suboffset < otherNewWords.length) {
                                    if (!(otherNewWords[suboffset] in dict)) {
                                        dict[otherNewWords[suboffset]] = NO_RULES;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ---- util/dictionary.js ----
    var dictWhiteSpaceExpression = /\s/g;
    function parseDictLine(line, options, dict) {
        var slashOffset = line.indexOf('/');
        var hashOffset = line.indexOf('#');
        var codes = '';
        var word, result;
        while (slashOffset > -1 && line.charCodeAt(slashOffset - 1) === 92 /* backslash */) {
            line = line.slice(0, slashOffset - 1) + line.slice(slashOffset);
            slashOffset = line.indexOf('/', slashOffset);
        }
        if (hashOffset > -1) {
            if (slashOffset > -1 && slashOffset < hashOffset) {
                word = line.slice(0, slashOffset);
                dictWhiteSpaceExpression.lastIndex = slashOffset + 1;
                result = dictWhiteSpaceExpression.exec(line);
                codes = line.slice(slashOffset + 1, result ? result.index : undefined);
            } else {
                word = line.slice(0, hashOffset);
            }
        } else if (slashOffset > -1) {
            word = line.slice(0, slashOffset);
            codes = line.slice(slashOffset + 1);
        } else {
            word = line;
        }
        word = word.trim();
        if (word) {
            addToDict(dict, word, ruleCodes(options.flags, codes.trim()), options);
        }
    }
    function parseDictionary(buf, options, dict) {
        var value = buf.toString();
        var last = value.indexOf('\n') + 1;
        var index = value.indexOf('\n', last);
        while (index > -1) {
            if (value.charCodeAt(last) !== 9 /* tab */) {
                parseDictLine(value.slice(last, index), options, dict);
            }
            last = index + 1;
            index = value.indexOf('\n', last);
        }
        parseDictLine(value.slice(last), options, dict);
    }

    // ---- util/flag.js ----
    function flagCheck(values, value, flags) {
        return flags && value in values && flags.indexOf(values[value]) > -1;
    }

    // ---- util/exact.js ----
    function exactMatch(context, value) {
        var index = -1;
        if (context.data[value]) {
            return !flagCheck(context.flags, 'ONLYINCOMPOUND', context.data[value]);
        }
        if (value.length >= context.flags.COMPOUNDMIN) {
            while (++index < context.compoundRules.length) {
                if (context.compoundRules[index].test(value)) {
                    return true;
                }
            }
        }
        return false;
    }

    // ---- util/normalize.js ----
    function normalizeValue(value, patterns) {
        var index = -1;
        while (++index < patterns.length) {
            value = value.replace(patterns[index][0], patterns[index][1]);
        }
        return value;
    }

    // ---- util/casing.js ----
    function casingExact(value) {
        return value === value.toLowerCase() ? 'l' : value === value.toUpperCase() ? 'u' : null;
    }
    function casingOf(value) {
        var head = casingExact(value.charAt(0));
        var rest = value.slice(1);
        if (!rest) return head;
        rest = casingExact(rest);
        if (head === rest) return head;
        if (head === 'u' && rest === 'l') return 's';
        return null;
    }

    // ---- util/form.js ----
    function formIgnore(flags, dict, all) {
        return flagCheck(flags, 'KEEPCASE', dict) || all || flagCheck(flags, 'FORBIDDENWORD', dict);
    }
    function formLookup(context, value, all) {
        var normal = value.trim();
        var alternative;
        if (!normal) return null;
        normal = normalizeValue(normal, context.conversion.in);
        if (exactMatch(context, normal)) {
            if (!all && flagCheck(context.flags, 'FORBIDDENWORD', context.data[normal])) return null;
            return normal;
        }
        if (normal.toUpperCase() === normal) {
            alternative = normal.charAt(0) + normal.slice(1).toLowerCase();
            if (formIgnore(context.flags, context.data[alternative], all)) return null;
            if (exactMatch(context, alternative)) return alternative;
        }
        alternative = normal.toLowerCase();
        if (alternative !== normal) {
            if (formIgnore(context.flags, context.data[alternative], all)) return null;
            if (exactMatch(context, alternative)) return alternative;
        }
        return null;
    }

    // ---- lib/dictionary.js (instance method: add a .dic document) ----
    function dictionaryMethod(buf) {
        var self = this;
        var index = -1;
        var rule, source, character, offset;
        parseDictionary(buf, self, self.data);
        while (++index < self.compoundRules.length) {
            rule = self.compoundRules[index];
            source = '';
            offset = -1;
            while (++offset < rule.length) {
                character = rule.charAt(offset);
                source += self.compoundRuleCodes[character].length
                    ? '(?:' + self.compoundRuleCodes[character].join('|') + ')'
                    : character;
            }
            self.compoundRules[index] = new RegExp(source, 'i');
        }
        return self;
    }

    // ---- lib/correct.js ----
    function correctMethod(value) {
        return Boolean(formLookup(this, value));
    }

    // ---- lib/spell.js ----
    function spellMethod(word) {
        var self = this;
        var value = formLookup(self, word, true);
        return {
            correct: self.correct(word),
            forbidden: Boolean(value && flagCheck(self.flags, 'FORBIDDENWORD', self.data[value])),
            warn: Boolean(value && flagCheck(self.flags, 'WARN', self.data[value]))
        };
    }

    // ---- lib/add.js / remove.js / personal.js ----
    function addMethod(value, model) {
        var self = this;
        addToDict(self.data, value, self.data[model] || NO_RULES, self);
        return self;
    }
    function removeMethod(value) {
        var self = this;
        delete self.data[value];
        return self;
    }
    function personalMethod(buf) {
        var self = this;
        var lines = buf.toString().split('\n');
        var index = -1;
        var line, forbidden, word, flagVal;
        if (self.flags.FORBIDDENWORD === undefined) self.flags.FORBIDDENWORD = false;
        flagVal = self.flags.FORBIDDENWORD;
        while (++index < lines.length) {
            line = lines[index].trim();
            if (!line) continue;
            line = line.split('/');
            word = line[0];
            forbidden = word.charAt(0) === '*';
            if (forbidden) word = word.slice(1);
            self.add(word, line[1]);
            if (forbidden) self.data[word].push(flagVal);
        }
        return self;
    }
    function wordCharactersMethod() {
        return this.flags.WORDCHARS || null;
    }

    // ---- lib/suggest.js ----
    function suggestMethod(value) {
        var self = this;
        var charAdded = {};
        var suggestions = [];
        var weighted = {};
        var memory, replacement, edits = [];
        var values, index, offset, position, count, otherOffset, otherCharacter, character;
        var group, before, after, upper, insensitive, firstLevel, previous, next, nextCharacter;
        var max, distance, size, normalized, suggestion, currentCase;

        value = normalizeValue(value.trim(), self.conversion.in);
        if (!value || self.correct(value)) return [];

        currentCase = casingOf(value);

        index = -1;
        while (++index < self.replacementTable.length) {
            replacement = self.replacementTable[index];
            offset = value.indexOf(replacement[0]);
            while (offset > -1) {
                edits.push(value.replace(replacement[0], replacement[1]));
                offset = value.indexOf(replacement[0], offset + 1);
            }
        }

        index = -1;
        while (++index < value.length) {
            character = value.charAt(index);
            before = value.slice(0, index);
            after = value.slice(index + 1);
            insensitive = character.toLowerCase();
            upper = insensitive !== character;
            charAdded = {};
            offset = -1;
            while (++offset < self.flags.KEY.length) {
                group = self.flags.KEY[offset];
                position = group.indexOf(insensitive);
                if (position < 0) continue;
                otherOffset = -1;
                while (++otherOffset < group.length) {
                    if (otherOffset !== position) {
                        otherCharacter = group.charAt(otherOffset);
                        if (charAdded[otherCharacter]) continue;
                        charAdded[otherCharacter] = true;
                        if (upper) otherCharacter = otherCharacter.toUpperCase();
                        edits.push(before + otherCharacter + after);
                    }
                }
            }
        }

        index = -1;
        nextCharacter = value.charAt(0);
        values = [''];
        max = 1;
        distance = 0;
        while (++index < value.length) {
            character = nextCharacter;
            nextCharacter = value.charAt(index + 1);
            before = value.slice(0, index);
            replacement = character === nextCharacter ? '' : character + character;
            offset = -1;
            count = values.length;
            while (++offset < count) {
                if (offset <= max) values.push(values[offset] + replacement);
                values[offset] += character;
            }
            if (++distance < 3) max = values.length;
        }
        push.apply(edits, values);

        values = [value];
        replacement = value.toLowerCase();
        if (value === replacement || currentCase === null) {
            values.push(value.charAt(0).toUpperCase() + replacement.slice(1));
        }
        replacement = value.toUpperCase();
        if (value !== replacement) values.push(replacement);

        memory = { state: {}, weighted: weighted, suggestions: suggestions };
        firstLevel = generate(self, memory, values, edits);

        previous = 0;
        max = Math.min(firstLevel.length, Math.pow(Math.max(15 - value.length, 3), 3));
        size = Math.max(Math.pow(10 - value.length, 3), 1);
        while (!suggestions.length && previous < max) {
            next = previous + size;
            generate(self, memory, firstLevel.slice(previous, next));
            previous = next;
        }

        suggestions.sort(sort);

        values = [];
        normalized = [];
        index = -1;
        while (++index < suggestions.length) {
            suggestion = normalizeValue(suggestions[index], self.conversion.out);
            replacement = suggestion.toLowerCase();
            if (normalized.indexOf(replacement) < 0) {
                values.push(suggestion);
                normalized.push(replacement);
            }
        }
        return values;

        function sort(a, b) {
            return sortWeight(a, b) || sortCasing(a, b) || sortAlpha(a, b);
        }
        function sortWeight(a, b) {
            return weighted[a] === weighted[b] ? 0 : weighted[a] > weighted[b] ? -1 : 1;
        }
        function sortCasing(a, b) {
            var leftCasing = casingOf(a);
            var rightCasing = casingOf(b);
            return leftCasing === rightCasing
                ? 0
                : leftCasing === currentCase ? -1 : rightCasing === currentCase ? 1 : undefined;
        }
        function sortAlpha(a, b) {
            return a.localeCompare(b);
        }
    }

    function generate(context, memory, words, edits) {
        var characters = context.flags.TRY;
        var data = context.data;
        var flags = context.flags;
        var result = [];
        var index = -1;
        var word, before, character, nextCharacter, nextAfter, nextNextAfter, nextUpper;
        var currentCase, position, after, upper, inject, offset;

        if (edits) {
            while (++index < edits.length) check(edits[index], true);
        }

        index = -1;
        while (++index < words.length) {
            word = words[index];
            before = '';
            character = '';
            nextCharacter = word.charAt(0);
            nextAfter = word;
            nextNextAfter = word.slice(1);
            nextUpper = nextCharacter.toLowerCase() !== nextCharacter;
            currentCase = casingOf(word);
            position = -1;

            while (++position <= word.length) {
                before += character;
                after = nextAfter;
                nextAfter = nextNextAfter;
                nextNextAfter = nextAfter.slice(1);
                character = nextCharacter;
                nextCharacter = word.charAt(position + 1);
                upper = nextUpper;
                if (nextCharacter) nextUpper = nextCharacter.toLowerCase() !== nextCharacter;

                if (nextAfter && upper !== nextUpper) {
                    check(before + switchCase(nextAfter));
                    check(before + switchCase(nextCharacter) + switchCase(character) + nextNextAfter);
                }

                check(before + nextAfter);
                if (nextAfter) check(before + nextCharacter + character + nextNextAfter);

                offset = -1;
                while (++offset < characters.length) {
                    inject = characters[offset];
                    if (upper && inject !== inject.toUpperCase()) {
                        if (currentCase !== 's') {
                            check(before + inject + after);
                            check(before + inject + nextAfter);
                        }
                        inject = inject.toUpperCase();
                        check(before + inject + after);
                        check(before + inject + nextAfter);
                    } else {
                        check(before + inject + after);
                        check(before + inject + nextAfter);
                    }
                }
            }
        }
        return result;

        function check(value, double) {
            var state = memory.state[value];
            var corrected;
            if (state !== Boolean(state)) {
                result.push(value);
                corrected = formLookup(context, value);
                state = corrected && !flagCheck(flags, 'NOSUGGEST', data[corrected]);
                memory.state[value] = state;
                if (state) {
                    memory.weighted[value] = double ? 10 : 0;
                    memory.suggestions.push(value);
                }
            }
            if (state) memory.weighted[value]++;
        }
        function switchCase(fragment) {
            var first = fragment.charAt(0);
            return (first.toLowerCase() === first ? first.toUpperCase() : first.toLowerCase()) + fragment.slice(1);
        }
    }

    // ---- lib/index.js ----
    function NSpell(aff, dic) {
        var index = -1;
        var dictionaries;

        if (!(this instanceof NSpell)) {
            return new NSpell(aff, dic);
        }

        if (typeof aff === 'string' || isBuffer(aff)) {
            if (typeof dic === 'string' || isBuffer(dic)) {
                dictionaries = [{ dic: dic }];
            }
        } else if (aff) {
            if ('length' in aff) {
                dictionaries = aff;
                aff = aff[0] && aff[0].aff;
            } else {
                if (aff.dic) dictionaries = [aff];
                aff = aff.aff;
            }
        }

        if (!aff) throw new Error('Missing `aff` in dictionary');

        aff = affix(aff);
        this.data = Object.create(null);
        this.compoundRuleCodes = aff.compoundRuleCodes;
        this.replacementTable = aff.replacementTable;
        this.conversion = aff.conversion;
        this.compoundRules = aff.compoundRules;
        this.rules = aff.rules;
        this.flags = aff.flags;

        if (dictionaries) {
            while (++index < dictionaries.length) {
                if (dictionaries[index].dic) {
                    this.dictionary(dictionaries[index].dic);
                }
            }
        }
    }

    NSpell.prototype.correct = correctMethod;
    NSpell.prototype.suggest = suggestMethod;
    NSpell.prototype.spell = spellMethod;
    NSpell.prototype.add = addMethod;
    NSpell.prototype.remove = removeMethod;
    NSpell.prototype.wordCharacters = wordCharactersMethod;
    NSpell.prototype.dictionary = dictionaryMethod;
    NSpell.prototype.personal = personalMethod;

    global.NSpell = NSpell;
})(typeof window !== 'undefined' ? window : this);
