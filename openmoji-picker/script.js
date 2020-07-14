
"use strict";

var OpenMoji = {

    Utils : class{
        /// Ensures the callback function is called, either immediately or once the DOM becomes interactable
        static whenReady(callback){
            if(document.readyState === "complete" || document.readyState === "interactive") {
                callback();
            }else{
                window.addEventListener('DOMContentLoaded', () => {
                    callback();
                });
            }
        }

        /// Performs a simple GET request on a resource and returns the response text within a Promise
        static get(url){
            return new Promise(function(resolve){
                let httpGet = new XMLHttpRequest();
                httpGet.onreadystatechange = function(){
                    if(httpGet.readyState == 4 && httpGet.status == 200){
                        resolve(httpGet.responseText);
                    }
                }
                httpGet.open('GET', url, true);
                httpGet.send(null);
            });
        }

        /// Returns whether the child node is nested within the parent node
        static isDescendant(child, parent){
            if(child === parent) return true;
            var node = child.parentNode;
            while(node){
                if(node === parent) return true;
                node = node.parentNode;
            }
            return false;
        }

        /// Calls replaceAll on the string provided, ensuring the characters it replaces are followed by whitespaces (or the end of the string)
        static replaceCharsWhitespace(str, src, dst, allowColonJoiner = true){
            let original = str;
            str = str.replaceAll(src+" ", dst+" ").replaceAll(src+"\n", dst+"\n").replaceAll(src+"<", dst+"<").replaceAll(src+"&", dst+"&");
            if(allowColonJoiner)
                str = str.replaceAll(src+":", dst+":");
            if(str.endsWith(src))
                str = str.substr(0, str.length - src.length) + dst;
            if(original !== str){ // keep replacing until nothing changes anymore
                return OpenMoji.Utils.replaceCharsWhitespace(str, src, dst, allowColonJoiner);
            }
            return str;
        }

        /// Calls replaceCharsWhitespace on all the values within an assoc array of the form
        /// {src0:dst0, src1:dst1, ...}
        static replaceCharsWhitespaceAssoc(str, assoc, allowColonJoiner = true){
            Object.keys(assoc).forEach((key) => {
                let val = assoc[key];
                str = OpenMoji.Utils.replaceCharsWhitespace(str, key, val, allowColonJoiner);
            });
            return str;
        }

    },// class Utils

    Converter : class{

        /**
         * Builds the converter object
         * Possible settings:
         * - injectStyles: set to false to bypass loading css; only use if you're adding the stylesheet manually; defaults to true
         * - cssUrl: the path at which to find the stylesheet; defaults to "openmoji-picker/style.css"
         * - jsonUrl: the path at which to find the json file with all the data about the available openmoji emojis; defaults to "openmoji/data/openmoji.json"
         * - altAsShorthands: set to true to set alt text to shorthand notations on emojis; false by default sets the alt attribute to unicode emojis
         * - convertToShorthands: set to false to convert emoji in text to unicode emojis (might break some emojis such as :polar-bear: when reconverting!); true by default
         * - allowEmoticons: set to false to prevent converting emoticons like "<3" to openmoji; defaults to true
         * - baseEmojiUrl: the path at which to find all the different OpenMoji svg files, including trailing slash; defaults to "openmoji/color/svg/"
         * - baseBWEmojiUrl: the path at which to find all the different OpenMoji black/white svg files, including trailing slash; defaults to baseEmojiUrl+"/../../black/svg/"
         * - readonlyClassName: the html class to use to find readonly openmoji content; defaults to "openmoji-readonly"
         * - editableClassName: the html class to use to find editable content; defaults to "openmoji-editable"
         * - pickerMixinClassName: the html class to use to find elements where pickers should be inserted; defaults to "with-openmoji-picker"
         * - scaleEmojis: if true, openmojis will be slightly scaled up; defaults to true
         * - verbose: if true, will log debug information to the console; can also be set to the string literal "full"; defaults to false
         */
        constructor(settings){
            settings = settings ?? {};

            this.settings = settings;

            // Features needed to ensure proper functionality
            MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

            /// Inject openmoji styles to <head>
            if(settings.injectStyles !== false){
                OpenMoji.Utils.get(settings.cssUrl ?? 'openmoji-picker/style.css').then((css) => {
                    let head = document.getElementsByTagName('head')[0];
                    let style = document.createElement('style');
                    style.innerHTML = css;
                    head.appendChild(style);
                });
            }

            /// Load OpenMoji data file
            this.__futureData = OpenMoji.Utils.get(settings.jsonUrl ?? 'openmoji/data/openmoji.json').then((data) => {
                this.__data = JSON.parse(data);
                // parse the data to divide into emoji groups
                let groups = {};
                this.__data.forEach((emojiData, index) => {
                    // catch emojis with duplicate annotations
                    // @todo: for now only White Flag exists twice, but this could use sturdier/more flexible code
                    if(emojiData.annotation === "white flag" && emojiData.tags != "waving"){
                        emojiData.annotation = "flat white flag";
                        emojiData.skintone_base_emoji = emojiData.emoji;
                        emojiData.emoji = null; // unmap from emoji
                        this.__data[index] = emojiData;
                    }
                    // Sort emojis into groups
                    let groupName = emojiData.group;
                    let baseEmoji = emojiData.skintone_base_emoji;
                    if(baseEmoji === "") baseEmoji = emojiData.emoji;
                    // apply special rules
                    if(groupName == "food-drink" && emojiData.subgroups == "food-marine") groupName = "animals-nature"; // these fellas aren't food!
                    switch(groupName){
                        case "smileys-emotion":
                        case "people-body":
                        case "component":
                            groupName = "smileys-people";
                            break;
                        case "extras-openmoji":
                        case "extras-unicode":
                            groupName = emojiData.subgroups;
                            switch(groupName){
                                case "smileys-emotion": groupName = "smileys-people"; break;
                                case "brand": groupName = "symbols"; break;
                                case "climate-environment": groupName = "animals-nature"; break;
                                case "emergency": groupName = "activities"; break;
                                case "gardening": groupName = "activities"; break;
                                case "healthcare": groupName = "activities"; break;
                                case "interaction": groupName = "symbols"; break;
                                case "people": groupName = "activities"; break;
                                case "subdivision-flag": groupName = "flags"; break;
                                case "symbol-other": groupName = "symbols"; break;
                                case "technology": groupName = "objects"; break;
                                case "ui-element": groupName = "symbols"; break;
                            }
                            break;
                    }
                    if(!(groupName in groups)){
                        let group = { count: 0, emojis: [], index: Object.keys(groups).length };
                        // assign header emoji
                        switch(groupName){
                            case "activities":
                                group.icon = "1F3C0"; // basketball
                                break;
                            case "animals-nature":
                                group.icon = "1FAB4"; // potted plant
                                break;
                            case "flags":
                                group.icon = "1F6A9"; // triangular flag
                                break;
                            case "food-drink":
                                group.icon = "1FAD0"; // blueberries
                                break;
                            case "objects":
                                group.icon = "1F4A1"; // light bulb
                                break;
                            case "smileys-people":
                                group.icon = "1F604"; // grinning face with smiling eyes
                                break;
                            case "symbols":
                                group.icon = "267B"; // recycling symbol
                                break;
                            case "travel-places":
                                group.icon = "1F6E9"; // small airplane
                                break;
                            default:
                                group.icon = "1F990"; // shrimp
                                break;
                        }
                        groups[groupName] = group;
                    }
                    if(!(baseEmoji in groups[groupName].emojis)){
                        ++groups[groupName].count;
                        groups[groupName].emojis[baseEmoji] = [];
                    }
                    groups[groupName].emojis[baseEmoji].push(emojiData);
                });
                // reformat groups to an indexed array
                this.groups = [];
                Object.keys(groups).forEach((groupName) => {
                    let group = groups[groupName];
                    group.name = groupName;
                    // reformat emojis within group to an indexed array
                    Object.keys(group.emojis).forEach((key, index) => {
                        group.emojis[index] = group.emojis[key];
                        delete group.emojis[key];
                    });
                    this.groups[group.index] = group;
                    delete group.index;
                });
                if(this.settings.verbose) console.log("Loaded OpenMoji data", this.__data, "divided into groups", this.groups);
            });

            /// Fired once DOM becomes interactable
            OpenMoji.Utils.whenReady(() => {

                /// Look for any openmoji-readonly elements and set up events on them
                let readonlys = document.getElementsByClassName(settings.readonlyClassName ?? 'openmoji-readonly');
                [...readonlys].forEach(readonly => {
                    this.bindReadonly(readonly);
                });

                /// Look for any openmoji-editable elements and instantiate them as editable openmoji fields
                let editables = document.getElementsByClassName(settings.editableClassName ?? 'openmoji-editable');
                [...editables].forEach(editable => {
                    this.bindEditable(editable);
                });

                /// Add picker elements to any DOM nodes with class with-openmoji-picker
                let pickers = document.getElementsByClassName(settings.pickerMixinClassName ?? 'with-openmoji-picker');
                [...pickers].forEach(picker => {
                    this.bindPickerButton(picker);
                });
            });
        }

        /// Returns the OpenMoji data asynchronously (as soon as it's available)
        getData(){
            return new Promise((resolve) => {
                if(this.__data !== undefined){
                    resolve(this.__data);
                }else{
                    this.__futureData.then(() => {
                        resolve(this.__data);
                    });
                }
            });
        }

        /// Returns the SVG path for an openmoji given its hexcode
        getEmojiSvgPath(hexcode, colour = true){
            let basePath = this.settings.baseEmojiUrl ?? "openmoji/color/svg/";
            if(!colour){
                if(this.settings.baseBWEmojiUrl == undefined){
                    basePath = basePath + "../../black/svg/";
                }else{
                    basePath = this.settings.baseBWEmojiUrl;
                }
            }
            return basePath + hexcode + '.svg';
        }

        /// Creates & returns the markup required to display an emoji as an svg image
        makeEmojiImage(data){
            let shorthand = this.getEmojiShorthand(data.annotation);
            let classes = "openmoji" + (shorthand.includes('flag') ? " openmoji-smaller" : "");
            let additionalAttributes = (this.settings.scaleEmojis !== false ? "scaled" : "");
            let alt = this.settings.altAsShorthands === true ? shorthand : data.emoji;
            return '<img class="'+classes+'" data-shorthand="'+shorthand+'" data-emoji="'+data.emoji+'" \
                    src="' + this.getEmojiSvgPath(data.hexcode) + '" \
                    title="'+data.annotation+'" alt="'+alt+'" ' + additionalAttributes + '>';
        }

        /// Creates & returns an element identical to Converter::makeEmojiImage(), but as a html node element
        makeEmojiImageNode(data){
            let shorthand = this.getEmojiShorthand(data.annotation);
            let img = document.createElement('img');
            img.className = "openmoji" + (shorthand.includes('flag') ? " openmoji-smaller" : "");
            if(this.settings.scaleEmojis !== false) img.setAttribute('scaled', '');
            img.alt = this.settings.altAsShorthands === true ? shorthand : data.emoji;
            img.setAttribute('data-shorthand', shorthand);
            img.setAttribute('data-emoji', data.emoji);
            img.src = this.getEmojiSvgPath(data.hexcode);
            img.title = data.annotation;
            return img;
        }

        /// Returns the shorthand notation of an emoji
        getEmojiShorthand(annotation){
            return ':' + annotation.toLowerCase().replaceAll(' ', '-').replaceAll(':', '') + ':';
        }

        /// Converts emoticons in text to :shorthand-notation:
        emoticonsToShorthands(text){
            text = OpenMoji.Utils.replaceCharsWhitespaceAssoc(text, {
                '&lt;3&lt;3&lt;3': ':dizzy::sparkling-heart::sparkling-heart::sparkling-heart::dizzy:',
                '&lt;3': ':red-heart:',
                '&lt;/3': ':broken-heart:',
                ':)': ':slightly-smiling-face:',
                '=)': ':slightly-smiling-face:',
                ':*': ':kissing-face-with-closed-eyes:',
                ';*': ':face-blowing-a-kiss:',
                '^^': ':smiling-face-with-smiling-eyes:',
                '^_^': ':smiling-face-with-smiling-eyes:',
                ':D': ':grinning-face-with-smiling-eyes:',
                '=D': ':grinning-face-with-smiling-eyes: ',
                '8)': ':smiling-face-with-sunglasses:',
                ';)': ':winking-face:',
                ':P': ':face-savoring-food:',
                ':p': ':face-with-tongue:',
                ';p': ':winking-face-with-tongue:',
                ':/': ':confused-face:',
                '=/': ':confused-face:',
                ':\\': ':confused-face:',
                '=\\': ':confused-face:',
                ':|': ':neutral-face:',
                '=|': ':neutral-face:',
                '-_-': ':expressionless-face:',
                ':o': ':face-with-open-mouth:',
                ':O': ':exploding-head:',
                ":'(": ':crying-face:',
                "='(": ':crying-face:',
                "&gt;:(": ':pouting-face:',
                "&gt;=(": ':pouting-face:',
                ':(': ':frowning-face:',
                '=(': ':frowning-face:',
                ')D&gt;-': ':tongue::victory-hand:',
                ':o)': ':clown-face:',
                '=o)': ':clown-face:',
                '(:': ':upside-down-face:',
                '(=': ':upside-down-face:'
            }, false);
            return text;
        }

        /// Converts some text containing unicode emojis or :shorthand-notations: to use svgs from openmoji instead
        textToEmojis(element){
            //this.emojisToText(element);
            let input = element.innerHTML;
            if(this.settings.verbose === "full") console.log("Converting text to emoji:", input);
            if(element.tagName.toLowerCase() == "input"){
                console.error("Cannot convert text to emojis within an <input> field; use contenteditable instead!");
                return;
            }
            return new Promise((resolve) => {
                this.getData().then((data) => {
                    // replace emoticons by :shorthands: in text
                    if(this.settings.allowEmoticons !== false){
                        input = this.emoticonsToShorthands(input);
                        if(this.settings.verbose === "full") console.log("After conversion to emoticons:", input);
                    }
                    // replace emojis and :shorthands: in text
                    for(let i = data.length-1; i >= 0; --i){
                        let emoji = this.makeEmojiImage(data[i]);
                        let shorthand = this.getEmojiShorthand(data[i].annotation);
                        if(data[i].emoji !== null){
                            input = OpenMoji.Utils.replaceCharsWhitespace(input, data[i].emoji, shorthand);
                        }
                        input = OpenMoji.Utils.replaceCharsWhitespace(input, shorthand, emoji);
                    }
                    if(this.settings.verbose === "full") console.log("After conversion from shorthands and emoji:", input);
                    // replace content with new openmoji content
                    element.innerHTML = input;
                    resolve(input);
                });
            });
        }

        /// Converts some text containing openmojis back to unicode or shorthand, depending on the settings applied
        emojisToText(element){
            if(this.settings.verbose === "full") console.log("Converting emoji to text:", element.innerHTML);
            let emojis = element.getElementsByClassName('openmoji');
            let toDelete = [];
            for(let i = 0; i < emojis.length; ++i){
                let placeholder = document.createElement('span');
                emojis[i].parentNode.insertBefore(placeholder, emojis[i]);
                if(this.settings.convertToShorthands === false){
                    placeholder.replaceWith(emojis[i].getAttribute('data-emoji'));
                }else{
                    placeholder.replaceWith(emojis[i].getAttribute('data-shorthand'));
                }
                toDelete.push(emojis[i]);
            }
            for(let i = toDelete.length - 1; i >= 0; --i){
                toDelete[i].remove();
            }
            return element.innerHTML;
        }

        /// Adds openmoji support to the element; anytime it changes, textToEmojis will be called for it
        bindReadonly(element){
            this.textToEmojis(element).then(() => {
                let observe = (observer) => {
                    observer.observe(element, {
                        subtree: true,
                        childList: true
                    });
                };
                let observer = new MutationObserver(() => {
                    observer.disconnect();
                    if(this.settings.verbose === "full") console.log("Updating openmoji-readonly contents for", element);
                    this.textToEmojis(element).then(() => {
                        observe(observer);
                    });
                });
                observe(observer);
            });
        }

        /// Makes the element editable (with support for openmoji)
        bindEditable(element){
            if(element.tagName.toLowerCase() == "input"){
                console.error("Cannot convert text to emojis within an <input> field; use <div>s instead.");
                return;
            }
            let child = document.createElement('div');
            // transfer contents of the original element to the child element
            child.innerHTML = element.innerHTML;
            element.innerHTML = "";
            element.removeAttribute('contenteditable');
            element.appendChild(child);
            // make child editable
            child.className = "openmoji-editable-input";
            child.id = "openmoji-editable-input-" + (""+Math.random()).substr(2);
            child.setAttribute('contenteditable', '');
            this.textToEmojis(child);
            // bind events
            child.caretSelection = null;
            document.addEventListener('selectionchange', () => {
                let sel = document.getSelection();
                let focusNode = sel.focusNode;
                // check that the selection change happened within this element
                if(document.activeElement !== document.body && OpenMoji.Utils.isDescendant(focusNode, child)){
                    // assign unique id to the focused node
                    let previousFocus = document.getElementById(child.id + "-focus");
                    if(previousFocus) previousFocus.removeAttribute('id');
                    if(focusNode.parentElement.id === undefined || focusNode.parentElement.id === "") focusNode.parentElement.id = child.id + "-focus";
                    child.caretSelection = {
                        parentNodeId: focusNode.parentElement.id,
                        offset: sel.focusOffset,
                        nodeIndex: [...focusNode.parentElement.childNodes].indexOf(focusNode)
                    };
                }
            });
            child.addEventListener('blur', e => {
                // convert text contents
                let initialContents = child.innerHTML;
                this.textToEmojis(child).then(() => {
                    if(initialContents != child.innerHTML){
                        // contents have been changed
                        child.caretSelection = null;
                    }
                });
            });
            // add functionality to the parent element for ease
            element.getInputElement = () => { return child; };
            element.getTextValue = () => { return child.innerHTML; };
        }

        /// Adds an openmoji picker to the element
        bindPickerButton(element){

            let picker = document.createElement('div');
            element.appendChild(picker);
            picker.className = 'openmoji-picker-button';
            picker.setAttribute('title', 'Insert emoji');
            picker.setAttribute('alt', 'Insert emoji');
            let pickerInstance = null;

            OpenMoji.Utils.get(this.getEmojiSvgPath('1F60A', false)).then((response) => {
                picker.innerHTML = response;
                OpenMoji.Utils.get(this.getEmojiSvgPath('1F604', true)).then((response) => {
                    picker.innerHTML += response;

                    picker.addEventListener('click', () => {
                        if(!pickerInstance){
                            pickerInstance = new OpenMoji.Picker(picker, element.getInputElement(), this);
                        }else{
                            pickerInstance.toggleVisibility();
                        }
                    });
                })
            });

        }

    },// class Converter

    Picker : class{

        /**
         * Displays the openmoji picker as coming out of the specified HTML element
         */
        constructor(originNode, inputFieldNode, converter){
            this.originNode = originNode;
            this.inputFieldNode = inputFieldNode;
            this.converter = converter;

            // build picker panel
            this.pickerElem = document.createElement('div');
            this.pickerElem.className = "openmoji-picker";
            this.pickerElem.tabIndex = "-1";
            this.pickerElem.title = "";
            this.pickerElem.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('click', (e) => {
                if(this.shown && !OpenMoji.Utils.isDescendant(e.target, this.pickerElem) && e.target !== this.originNode)
                    this.hide();
            });
            this.hide();
            originNode.appendChild(this.pickerElem);

            // build top container (search icon and input)
            let top = document.createElement('div');
            this.pickerElem.appendChild(top);
            top.className = 'openmoji-picker-top';
            top.title = "Search for emoji by name";
            OpenMoji.Utils.get(converter.getEmojiSvgPath('1F50E', false)).then((response) => {
                top.innerHTML = response;// search icon as svg node
                let input = document.createElement('input');
                top.appendChild(input);
                input.setAttribute('type', 'text');
                input.setAttribute('placeholder', 'Search emoji');
            });

            // build category tabs & emoji div
            let categories = document.createElement('div');
            let emojiContainer = document.createElement('div');
            this.pickerElem.appendChild(categories);
            this.pickerElem.appendChild(emojiContainer);
            categories.className = 'openmoji-picker-categories';
            emojiContainer.className = 'openmoji-picker-emoji-container';
            let selectCategory = (categoryButton, group) => {
                categoryButton.setAttribute('selected', '');
                // display emojis to select from
                emojiContainer.innerHTML = "";
                emojiContainer.scrollTop = 0;
                group.emojis.forEach((skintones) => {
                    let mainEmoji = skintones[0];
                    let img = document.createElement('img');
                    img.src = this.converter.getEmojiSvgPath(mainEmoji.hexcode);
                    img.className = 'openmoji-picker-emoji-button';
                    img.title = mainEmoji.annotation;
                    img.addEventListener('click', () => {
                        this.insertEmoji(this.converter.makeEmojiImageNode(mainEmoji));
                    });
                    emojiContainer.appendChild(img);
                });
            }
            let unselectCategory = (categoryButton) => {
                categoryButton.removeAttribute('selected');
            }
            converter.groups.forEach((group, index) => {
                let tabButton = document.createElement('div');
                categories.appendChild(tabButton);
                tabButton.className = 'openmoji-picker-category-button';
                tabButton.setAttribute('title', group.name.replace('-', ' & '));
                tabButton.setAttribute('alt', "Select emoji category: "+group.name.replace('-', ' and '));
                tabButton.emojiCategory = index;
                tabButton.setAttribute('emoji-category', index);
                if(index <= 0){
                    selectCategory(tabButton, group);
                }
                OpenMoji.Utils.get(converter.getEmojiSvgPath(group.icon, false)).then((response) => {
                    tabButton.innerHTML = response;// default icon
                    OpenMoji.Utils.get(converter.getEmojiSvgPath(group.icon)).then((response) => {
                        tabButton.innerHTML += response;// hover icon
                        tabButton.addEventListener('click', () => {
                            [...categories.childNodes].forEach((categoryButton) => {
                                unselectCategory(categoryButton);
                            });
                            selectCategory(tabButton, group);
                        });
                    });
                });
            });

            // build license disclaimer
            let disclaimer = document.createElement('div');
            this.pickerElem.appendChild(disclaimer);
            disclaimer.className = "openmoji-picker-disclaimer";
            disclaimer.innerHTML = "Uses <a href='https://openmoji.org/'>OpenMoji</a> under <a href='https://creativecommons.org/licenses/by-sa/4.0/'>CC BY-SA 4.0</a> | ⚑ <a href='https://github.com/k-j0/openmoji-picker/issues/'>Report picker issues</a>";

            this.show();
        }

        /**
         * Closes the picker element
         */
        hide(){
            this.pickerElem.setAttribute('aria-hidden', '');
            this.shown = false;
        }

        /**
         * Opens the picker element after it's been closed
         */
        show(){
            // place element at a good spot to be as visible as possible
            let aabb = this.originNode.getBoundingClientRect();
            let center = {x: (aabb.left + Math.abs(aabb.width)/2), y: (aabb.top + Math.abs(aabb.height)/2)};
            let fromTop = center.y < document.documentElement.clientHeight / 2;
            let fromLeft = center.x < document.documentElement.clientWidth / 2;
            this.pickerElem.setAttribute('from', (fromTop ? "top" : "bottom")+'-'+(fromLeft ? "left" : "right"));

            this.pickerElem.removeAttribute('aria-hidden');
            this.shown = true;
        }

        /**
         * Toggles between hide() and show()
         */
        toggleVisibility(){
            if(this.shown) this.hide();
            else this.show();
        }

        /**
         * Inserts an emoji within the given node (leave node as null to use current input field)
         * The insertion will happen at the last known caret position, or at the end if none.
         */
        insertEmoji(emojiElement, element = null){
            if(element === null) element = this.inputFieldNode;

            if(this.converter.settings.verbose === "full") console.log("Inserting element", emojiElement, "into", element);

            this.hide();
            if(element.caretSelection !== null){
                if(this.converter.settings.verbose === "full") console.log("Using selection", element.caretSelection);
                let node = document.getElementById(element.caretSelection.parentNodeId).childNodes[element.caretSelection.nodeIndex];
                let offset = element.caretSelection.offset;
                if(node.nodeName == '#text'){
                    if(this.converter.settings.verbose === "full") console.log("Inserting into text node", node, "at offset", offset);
                    let parent = node.parentElement;
                    let value = node.textContent;
                    parent.insertBefore(document.createTextNode(value.substr(0, offset)), node);
                    parent.insertBefore(emojiElement, node);
                    parent.insertBefore(document.createTextNode(value.substr(offset)), node);
                    parent.removeChild(node);
                }else{
                    if(this.converter.settings.verbose === "full") console.log("Inserting into non-text node", node, "at offset", offset);
                    node.insertBefore(emojiElement, node.childNodes[offset]);
                }
            }else{
                // no selection available for the element, insert at the very end
                let finalNode = element;
                if(element.childNodes.length > 0 && element.childNodes[element.childNodes.length - 1].nodeName.toLowerCase() == "div"){
                    finalNode = element.childNodes[element.childNodes.length - 1];
                }
                // ensure we don't insert on a new line (contenteditable will insert <br> tag upon pressing space)
                if(finalNode.innerHTML.endsWith('<br>')) finalNode.innerHTML = finalNode.innerHTML.substr(0, finalNode.innerHTML.length - '<br>'.length);
                else if(finalNode.innerHTML.endsWith('<br/>')) finalNode.innerHTML = finalNode.innerHTML.substr(0, finalNode.innerHTML.length - '<br/>'.length);
                finalNode.innerHTML += emojiElement.outerHTML;
            }
        }

    }// class Picker

}// namespace OpenMoji
