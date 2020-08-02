
:: Generates a spritesheet for use with the OpenMoji picker
:: The generated CSS file is intended to be as small as possible rather than valid syntax,
:: to be expanded using JavaScript back to full CSS
:: Following the rules:
:: - $s is the url of the SVG spritesheet, surrounded by url( and )
:: - $b is the base CSS class string, postpended with a hyphen and the emoji hexcode

:: ---------------------------------------------- ::


:: Delete files generated prior
del openmoji-sprite-styles.css
del openmoji-spritesheet.svg

:: Run svg-sprite on all svg files contained within ../openmoji/color/svg/
node ../node_modules/svg-sprite/bin/svg-sprite ^
	-D="." ^
	-l="info" ^
	--shape-id-separator="-" ^
	--svg-namespace-ids=false ^
	--svg-namespace-classnames=false ^
	-c ^
	--css-dest="" ^
	--cl="vertical" ^
	--css-prefix="." ^
	--css-dimensions="" ^
	--cs "openmoji.svg" ^
	--ccss ^
	"../openmoji/color/svg/*.svg"


:: ---- ::
:: Clean up generated SVG spritesheet

:: Rename generated spritesheet
ren *.svg openmoji-spritesheet.svg

:: Remove 'id="..."' from spritesheet
powershell -Command $"(Get-Content openmoji-spritesheet.svg) -replace 'id=\"[-a-zA-Z0-9]+\" ', '' | Out-File -encoding ASCII openmoji-spritesheet.svg"

:: Remove 'viewBox="0 0 72 72"' from spritesheet
powershell -Command $"(Get-Content openmoji-spritesheet.svg) -replace 'viewbox=\"[-a-zA-Z0-9 ]+\" ', '' | Out-File -encoding ASCII openmoji-spritesheet.svg"


:: ---- ::
:: Clean up generated CSS stylesheet

:: Replace 'url("...")' with 'url($spritesheet)' in stylesheet
powershell -Command "(Get-Content sprite.css) -replace 'url\(.*\)', '$s' | Out-File -encoding ASCII sprite.css"

:: Replace '.openmoji-color-svg-' (original directory where svgs were located) with '.$b.x' in stylesheet
powershell -Command "(Get-Content sprite.css) -replace 'openmoji-color-svg-', '$b.x' | Out-File -encoding ASCII sprite.css"

:: Remove 'width: 72px; height: 72px;' from the stylesheet
powershell -Command "(Get-Content sprite.css) -replace 'width\: .*px;', '' | Out-File -encoding ASCII sprite.css"
powershell -Command "(Get-Content sprite.css) -replace 'height\: .*px;', '' | Out-File -encoding ASCII sprite.css"

:: Remove 'no-repeat' from the stylesheet
powershell -Command "(Get-Content sprite.css) -replace 'no-repeat', '' | Out-File -encoding ASCII sprite.css"

:: Minify stylesheet and delete original
node ../node_modules/postcss-cli/bin/postcss sprite.css > openmoji-sprite-styles.css
del sprite.css
