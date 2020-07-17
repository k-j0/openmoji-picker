# OpenMoji Picker
A simple hassle-free vanilla JavaScript emoji picker that can be integrated to allow users to use and view [OpenMojis](https://openmoji.org/) on websites.

Still in very early development phase, don't expect anything stable right now. Feel free to issue problems, or submit a pull request if you have time to implement something yourself.

[View example page](https://jonathan-kings.com/openmoji-picker/)

## License information
You are free to use this library for whatever project you want. However, I would like to kindly request you refrain from using it on websites that support racism, speciesism, violence, discrimination or harassment. Actually, just refrain from working on such websites entirely :)

Remember to attribute and link to [OpenMoji](https://openmoji.org/). The picker already contains a link to the OpenMoji CC BY-SA 4.0 license, but the contributors who worked hard on the project probably deserve another, flashier, mention somewhere else on the website you're building.

## Roadmap
+ Implement spritesheets instead of individual SVGs for increased performance
+ Support selecting different skin tone variants from the picker
+ Optimize loading times by baking+formatting data ahead of time
+ Better organization of the emojis in the various categories
+ Transition to the OpenMoji font rather than SVGs/sprites for better performance once it becomes supported on major browsers
+ Provide server-side scripts for validation/conversion of strings containing emojis
+ Release picker as a package for the different frontend frameworks

## Usage guide
Copy the [openmoji-picker](openmoji-picker) folder to your project folders and include [openmoji-picker/script.js](openmoji-picker/script.js) to get started. Clone the [OpenMoji](https://github.com/hfg-gmuend/openmoji) repository to your project folder as well (the only required folders are `black`, `color` and `data`).

Add the HTML class `openmoji-readonly` to any elements that contain or will be updated to contain unicode emojis, emoticons (`<3`, `:)`, etc) or shorthand notations (`:shrimp:`, `:frog:`, etc); any changes in the element will update its contents to show OpenMojis.

Add the HTML class `openmoji-editable` to any elements that may receive user input containing emojis; you can add the class `with-openmoji-picker` to also display an emoji picker on that element. Note that `input` and `textarea` elements do not support SVGs, so only `div`s with `contenteditable` can be made `openmoji-editable`.

Instantiate an `OpenMoji.Converter` object with optional settings as follow in the table below. As soon as the `Converter` is created, emojis on the page in readonly or editable elements will be converted.
```js
// Can be called wherever, whenever
new OpenMoji.Converter({
	injectStyles: true,
	allowEmoticons: true,
	readonlyClassName: "openmoji-readonly",
	verbose: "full"
});
```
| Setting Name | Possible values | Default Value | Effect |
|---|---|---|---|
|`injectStyles`|`true` or `false`|`true`|If left as `true`, CSS styles for the picker will be loaded upon instantiating the `Converter`. Include the `style.css` stylesheet manually if setting to `false`.|
|`cssUrl`|path string literal|`"openmoji-picker/style.css"`|The relative or absolute path to the CSS stylesheet, used if `injectStyles` evaluates to `true`.|
|`jsonUrl`|path string literal|`"openmoji/data/openmoji.json"`|The relative or absolute path to the OpenMoji data json file (from the OpenMoji repository).|
|`altAsShorthands`|`true` or `false`|`false`|If set to true, the `alt` attribute on OpenMoji elements will be set to the :shorthand-notation:, otherwise will be set to the unicode emoji.|
|`convertToShorthands`|`true` or `false`|`true`|Whether to convert OpenMoji elements to :shorthand-notation: or unicode emojis when calling `emojiToText`; beware of setting this to `false`, as composite emojis might break apart when converting the same text several times.|
|`allowEmoticons`|`true` or `false`|`true`|If `true`, emoticons such as `<3` or `:)` will be converted to OpenMoji elements, similarly to `:red-heart:`.|
|`baseEmojiUrl`|path string literal|`"openmoji/color/svg/"`|The relative or absolute path to the colour OpenMoji SVG folder (from the OpenMoji repository).|
|`baseBWEmojiUrl`|path string literal|`"openmoji/black/svg/"`|The relative or absolute path to the black and white OpenMoji SVG folder (from the OpenMoji repository).|
|`readonlyClassName`|HTML class name|`"openmoji-readonly"`|The class that is used to find readonly elements on the page.|
|`editableClassName`|HTML class name|`"openmoji-editable"`|The class that is used to find editable elements on the page.|
|`pickerMixinClassName`|HTML class name|`"with-openmoji-picker"`|The class that is used to find elements on the page that should be assigned an emoji picker.|
|`scaleEmojis`|`true` or `false`|`true`|OpenMojis are slightly smaller than native emojis, so this setting causes all OpenMoji elements to be scaled up slightly.|
|`verbose`|`true`, `false` or `"full"`|`false`|`true` outputs a small amount of runtime information about the status of the OpenMoji picker; `false` only logs errors; `"full"` outputs an insane amount of information.|

This library is still in very early stage, so no complete documentation has been written just yet unfortunately. Hopefully the inline documentation is enough to get started :)

