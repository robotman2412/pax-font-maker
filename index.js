
var convCtx;
var font        = "Source Code Pro";
var fontUrl     =
// "https://robot.scheffers.net/s/font/saira/saira-v5-latin-regular.ttf";
"https://fonts.cdnfonts.com/s/12262/PermanentMarker.woff";
var fontGlyphs;
var fontRanges;

var gridElem;
var gridScale   = 10;
var gridDx      = -5;
var gridDy      = -5;
var gridWidth   = 30;
var gridHeight  = 30;
var glyphWidth  = 10;
var glyphHeight = 16;
var glyph       = 65;

var gridData;
var paintValue  = true;

var maxWidth    = 0;

var glyphs      = {};
var glyphToCopy = 65;
var unsavedData = false;

var saveSelElem;
var saveName    = font;
var storageKey  = null;

function loaded() {
	gridElem = document.getElementById("canvas");
	convCtx = document.getElementById("converter").getContext("2d");
	convCtx.textAlign = "top";
	
	// Importing.
	document.getElementById("font_name").onchange = (event) => {
		font = event.target.value;
		saveData();
	};
	document.getElementById("font_url").onchange = (event) => {
		fontUrl = event.target.value;
		saveData();
	};
	document.getElementById("import").onclick = () => {
		document.getElementById("font_importer").innerHTML =
			`@font-face {
				font-family: ${font};
				src:         url(${JSON.stringify(fontUrl)});
				font-weight: normal;
			}`;
		findGlyphs(fontUrl, () => {
			startFullConversion();
		});
	};
	
	// Visualisation settings.
	document.getElementById("show_grid").oninput = (event) => {
		if (event.target.checked) {
			gridElem.classList.add("grid");
		} else {
			gridElem.classList.remove("grid");
		}
	};
	document.getElementById("show_ruler").oninput = (event) => {
		if (event.target.checked) {
			gridElem.classList.add("ruler");
		} else {
			gridElem.classList.remove("ruler");
		}
	};
	document.getElementById("show_outlines").oninput = (event) => {
		glyphChanged();
	};
	
	// Grid settings.
	document.onkeydown = (event) => {
		if (event.key == '-' || event.key == '_') {
			scaleGrid(-1);
		} else if (event.key == '+' || event.key == '=') {
			scaleGrid(1);
		} else {
			if (event.shiftKey) {
				if (event.key == 'ArrowUp') {
					shiftGrid(0, -1);
				} else if (event.key == 'ArrowDown') {
					shiftGrid(0, 1);
				} else if (event.key == 'ArrowLeft') {
					shiftGrid(-1, 0);
				} else if (event.key == 'ArrowRight') {
					shiftGrid(1, 0);
				}
			} else {
				if (event.key == 'ArrowLeft') {
					selectGlyph(glyph - 1);
				} else if (event.key == 'ArrowRight') {
					selectGlyph(glyph + 1);
				}
			}
		}
	};
	document.getElementById("ruler_x").oninput = (event) => {
		gridDx = -Number(event.target.value);
		resizeGrid(gridWidth, gridHeight);
	};
	document.getElementById("ruler_y").oninput = (event) => {
		gridDy = -Number(event.target.value);
		resizeGrid(gridWidth, gridHeight);
	};
	document.getElementById("glyph_width").oninput = (event) => {
		glyphWidth = Number(event.target.value);
		glyphChanged();
	};
	document.getElementById("glyph_height").oninput = (event) => {
		glyphHeight = Number(event.target.value);
		glyphChanged();
		updateRanges();
	};
	document.getElementById("canvas_width").oninput = (event) => {
		resizeGrid(Number(event.target.value), gridHeight);
	};
	document.getElementById("canvas_height").oninput = (event) => {
		resizeGrid(gridWidth, Number(event.target.value));
	};
	
	// Glyph selection.
	document.getElementById("prev_glyph").onclick = (event) => {
		selectGlyph(glyph - 1);
	}
	document.getElementById("next_glyph").onclick = (event) => {
		selectGlyph(glyph + 1);
	}
	document.getElementById("glyph_text").oninput = (event) => {
		var str = event.target.value.trim();
		if (str.length == 1) {
			selectGlyph(str.codePointAt(0));
		} else {
			var index = Number(`0x${str}`);
			if (!isNaN(index)) selectGlyph(index);
		}
	}
	document.getElementById("glyph_point").onchange = (event) => {
		var str = event.target.value.trim();
		if (str.toLowerCase().startsWith("u+")) {
			str = str.substring(2);
		}
		var index = Number(`0x${str}`);
		if (!isNaN(index)) selectGlyph(index);
	};
	
	// Copy/paste.
	document.getElementById("copy").onclick = () => {
		glyphToCopy = glyph;
	};
	document.getElementById("paste").onclick = () => {
		copyGlyph(glyphToCopy);
	};
	
	// TRANSLATE... ?
	document.getElementById("shift_up").onclick = () => {
		shiftGrid(0, -1);
	};
	document.getElementById("shift_down").onclick = () => {
		shiftGrid(0, 1);
	};
	document.getElementById("shift_left").onclick = () => {
		shiftGrid(-1, 0);
	};
	document.getElementById("shift_right").onclick = () => {
		shiftGrid(1, 0);
	};
	
	// Set up the grid!
	resizeGrid(gridWidth, gridHeight);
	showGlyphOutlines();
	
	// Save your data!
	saveSelElem = document.getElementById("save_slot");
	saveSelElem.oninput = () => saveSlotSelected(saveSelElem);
	document.getElementById("download").onclick = () => {
		downloadBase64(`${font}.json`, exportData(saveName));
	};
	
	// Import storage.
	if ("num_fonts" in localStorage) {
		for (var i = 0; i < localStorage.getItem("num_fonts"); i++) {
			var data       = JSON.parse(atob(localStorage.getItem(`fonts_${i}`)));
			var optn       = document.createElement("option");
			optn.value     = `fonts_${i}`;
			optn.innerHTML = data.name;
			saveSelElem.options.add(optn);
		}
		saveSelElem.value  = localStorage.getItem("font_selected");
		saveSlotSelected(saveSelElem);
	}
	
	// Import it?
	if (saveSelElem.value == "new_slot") {
		saveSelElem.value = "unsaved";
	} else if (saveSelElem.value in localStorage) {
		saveSlotSelected(saveSelElem);
	}
	
	// window.onbeforeunload = () => {
	// 	return unsavedData ? "Leave without saving?" : null;
	// }
}



/* ==== Grid functions ==== */

// Scale the grid.
function scaleGrid(delta) {
	gridScale += delta;
	if (gridScale < 3) gridScale = 3;
	else if (gridScale > 30) gridScale = 30;
	var fancy = document.getElementById("grid_zoomer");
	fancy.innerHTML = `#canvas td {
		width:  ${gridScale}px;
		height: ${gridScale}px;
	}`;
}

// Create the grid.
function makeGrid(elem, id, dx, dy, width, height, callback) {
	var raw = "<table>";
	for (var y = 0; y < height; y++) {
		raw += `<tr y="${y+dy}">`;
		for (var x = 0; x < width; x++) {
			raw += `<td id="${id}_${x}_${y}" x="${x+dx}" y="${y+dy}"></td>`;
		}
		raw += `</tr>`;
	}
	raw += "</table>";
	elem.innerHTML = raw;
	if (callback) {
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				var cell = document.getElementById(`${id}_${x}_${y}`);
				callback(cell, x, y, x+dx, y+dy);
			}
		}
	}
	
	var data = Array(height);
	for (var y = 0; y < height; y++) {
		data[y] = Array(width);
		data[y].fill(false);
	}
	return data;
}

// Resize the grid.
function resizeGrid(w, h) {
	gridWidth  = w;
	gridHeight = h;
	
	document.getElementById("canvas_width").value = gridWidth;
	document.getElementById("canvas_height").value = gridHeight;
	
	gridData = makeGrid(
		document.getElementById("canvas"), "canvas", 
		gridDx, gridDy, gridWidth, gridHeight,
		(elem, x, y, px, py) => {
		elem.onmousedown = () => {
			paintCell(x, y, undefined);
			glyphChanged();
			redrawPreview(glyph);
		};
		elem.onmouseenter = (event) => {
			if (event.buttons) {
				paintCell(x, y, paintValue);
				glyphChanged();
				redrawPreview(glyph);
			}
		};
	});
	
	selectGlyph(glyph);
}

// Shift the contents of the grid.
function shiftGrid(dx, dy) {
	if (dx < 0) {
		for (var y = 0; y < gridHeight; y++) {
			for (var x = 0; x < gridWidth - 1; x++) {
				gridData[y][x] = gridData[y][x + 1];
			}
		}
		for (var y = 0; y < gridHeight; y++) {
			gridData[y][gridWidth - 1] = false;
		}
	} else if (dx > 0) {
		for (var y = 0; y < gridHeight; y++) {
			for (var x = gridWidth - 2; x >= 0; x--) {
				gridData[y][x + 1] = gridData[y][x];
			}
		}
		for (var y = 0; y < gridHeight; y++) {
			gridData[y][0] = false;
		}
	}
	if (dy < 0) {
		for (var y = 0; y < gridHeight - 1; y++) {
			gridData[y] = gridData[y + 1];
		}
		gridData[gridHeight - 1] = Array(gridWidth).fill(false)
	} else if (dy > 0) {
		for (var y = gridHeight - 2; y >= 0; y--) {
			gridData[y + 1] = gridData[y];
		}
		gridData[0] = Array(gridWidth).fill(false)
	}
	glyphChanged();
	redrawPreview(glyph);
	selectGlyph(glyph);
}

// Show or hide glyph outlines.
function showGlyphOutlines(value) {
	if (value == undefined) {
		value = document.getElementById("show_outlines").checked;
	}
	
	// Remove outline bits.
	document.querySelectorAll("#canvas td").forEach((elem) => {
		elem.classList.remove("outline-left", "outline-top", "glyph-left", "glyph-top");
	});
	if (!value) return;
	
	function outline(x, y, width, height, left, top) {
		// Top and bottom lines.
		for (var i = x; i < x + width; i++) {
			document.querySelectorAll(
				`#canvas td[x="${i}"][y="${y}"],`
			  + `#canvas td[x="${i}"][y="${y+height}"]`
			).forEach((elem) => {
				elem.classList.add(top);
			});
		}
		
		// Left and right lines.
		for (var i = y; i < y + height; i++) {
			document.querySelectorAll(
				`#canvas td[y="${i}"][x="${x}"],`
			  + `#canvas td[y="${i}"][x="${x+width}"]`
			).forEach((elem) => {
				elem.classList.add(left);
			});
		}
	}
	
	// Outline of formal size.
	outline(0, 0, glyphWidth, glyphHeight, "outline-left", "outline-top");
	
	// Detect actual size.
	var dims = getGlyphBounds();
	// Outline of actual size.
	if (dims) {
		outline(
			dims.x,
			dims.y,
			dims.width,
			dims.height,
			"glyph-left", "glyph-top"
		);
	}
}

// Extract data from the grid.
function extractGridData(dx, dy, width, height) {
	var data = Array(height);
	for (var y = 0; y < height; y++) {
		data[y] = Array(width);
		for (var x = 0; x < width; x++) {
			data[y][x] = gridData[y + dy - gridDy][x + dx - gridDx];
		}
	}
	return data;
}

// Clear the entire grid.
function clearGrid() {
	for (var y = 0; y < gridHeight; y++) {
		for (var x = 0; x < gridWidth; x++) {
			gridData[y][x] = false;
		}
	}
	document.querySelectorAll("#canvas td").forEach(
		(elem) => elem.style.backgroundColor = "white"
	);
}

// Insert data into the grid.
function insertData(dx, dy, width, height, data) {
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			var value = gridData[y + dy - gridDy][x + dx - gridDx] = data[y][x];
			var elem  = document.querySelector(`#canvas td[x="${x+dx}"][y="${y+dy}"]`);
			elem.style.backgroundColor = value ? "black" : "white";
		}
	}
	showGlyphOutlines(undefined);
}



/* ==== Editor functions ==== */

// Convert a glyph from a pre-existing font into the current slot.
function convertGlyphToCurrent(font, text, threshold=127) {
	// Paint the font thingy.
	convCtx.clearRect(0, 0, 200, 200);
	convCtx.font         = `${glyphHeight}px ${font}`;
	convCtx.textBaseline = "top";
	convCtx.fillStyle    = "black";
	convCtx.fillText(text, -gridDx, -gridDy);
	
	// Get the dimensions.
	glyphWidth = Math.ceil(convCtx.measureText(text).width);
	document.getElementById("glyph_width").value = glyphWidth;
	
	// Get the data into the GRID.
	var arr = convCtx.getImageData(0, 0, gridWidth, gridHeight).data;
	for (var y = 0; y < gridHeight; y++) {
		for (var x = 0; x < gridWidth; x++) {
			// We care about the alpha value of pixels.
			var index = (y * gridWidth + x) * 4 + 3;
			var value = arr[index] > threshold;
			paintCell(x, y, value);
		}
	}
	showGlyphOutlines(undefined);
	glyphChanged();
	redrawPreview(glyph);
}

// Start the process of converting the entire font's glyphs.
var conversionProgress;
function startFullConversion() {
	conversionProgress = 0;
	var callback = () => {
		if (conversionProgress >= fontGlyphs.length) return;
		var point = fontGlyphs[conversionProgress];
		selectGlyph(point);
		convertGlyphToCurrent(font, String.fromCodePoint(point));
		conversionProgress ++;
		setTimeout(callback, 5);
	};
	setTimeout(callback, 5);
}

// Paint a single pixel of the glyph.
function paintCell(x, y, value) {
	// Update the big grid.
	var elem = document.getElementById(`canvas_${x}_${y}`);
	if (value == undefined) {
		value = !gridData[y][x];
	} else {
		value = !!value;
	}
	elem.style.backgroundColor = value ? "black" : "white";
	elem.setAttribute("value", value);
	
	// Update some datas.
	paintValue = value;
	gridData[y][x] = value;
	unsavedData = true;
}

// Copy the data of another glyph onto the current.
function copyGlyph(source) {
	if (source == glyph || !source) return;
	
	clearGrid();
	var data = glyphs[source];
	if (data) {
		glyphWidth = data.width;
		document.getElementById("glyph_width").value = glyphWidth;
		if (data.visible) {
			document.getElementById("glyph_width").value = glyphWidth;
			insertData(data.bounds.x, data.bounds.y, data.bounds.width, data.bounds.height, data.data);
		}
	}
	glyphChanged();
	showGlyphOutlines(undefined);
	redrawPreview(glyph);
}

// Find all the glyphs in the font using some magic.
function findGlyphs(fontUrl, then=undefined) {
	var out = [];
	opentype.load(fontUrl, (err, font) => {
		if (!font) return;
		
		// Do some simple data conversion.
		for (var i = 0; i < font.glyphs.length; i++) {
			var unicode = font.glyphs.glyphs[i].unicode;
			if (unicode)
				out = out.concat(unicode);
		}
		// Sort code points.
		fontGlyphs = out.sort((a, b) => a - b);
		
		// Fart out some ranges HTML.
		updateRanges();
		if (then) then();
	});
}

// Update the entire ranges table.
function updateRanges() {
	if (!fontGlyphs) return;
	
	// Create ranges of code points.
	var start  = fontGlyphs[0];
	var prev   = start;
	var ranges = [];
	for (var i = 1; i < fontGlyphs.length; i++) {
		if (prev + 1 != fontGlyphs[i]) {
			ranges = ranges.concat({start: start, end: prev});
			start = fontGlyphs[i];
		}
		prev = fontGlyphs[i];
	}
	ranges = ranges.concat({start: start, end: prev});
	fontRanges = ranges;
	
	// Generate some raw HTMLs.
	var raw = `<h1>GLYPHS</h1>`;
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		raw += `<p>${unicodeNumber(range.start)} - ${unicodeNumber(range.end)}</p>`;
		raw += `<canvas id="range_${i}"></canvas>`;
	}
	document.getElementById("glyphs").innerHTML = raw;
	
	// Let's draw some crap.
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		var count = range.end - range.start + 1;
		var elem = document.getElementById(`range_${i}`);
		elem.width = 8 * 2 * glyphHeight;
		elem.height = glyphHeight * Math.max(count / 8) + glyphHeight;
		
		for (var glyph = range.start; glyph <= range.end; glyph ++) {
			redrawPreview(glyph);
		}
	}
}

// Redraw the preview of a glyph.
function redrawPreview(glyph) {
	if (!fontRanges) return;
	
	// Find the appropriate range.
	var index = -1;
	for (var i = 0; i < fontRanges.length; i++) {
		if (glyph >= fontRanges[i].start && glyph <= fontRanges[i].end) {
			index = i;
			break;
		}
	}
	if (index == -1) return;
	var range = fontRanges[index];
	
	// Find some more context.
	var ctx   = document.getElementById(`range_${index}`).getContext("2d");
	var dx    = (glyph - range.start) % 8;
	var dy    = Math.floor((glyph - range.start) / 8);
	dx       *= glyphHeight * 2;
	dy       *= glyphHeight;
	var data  = glyphs[glyph];
	
	// Start drawing!
	ctx.fillStyle = "white";
	ctx.fillRect(dx, dy, glyphHeight * 2, glyphHeight);
	if (data && data.visible) {
		dx += data.bounds.x;
		dy += data.bounds.y;
		for (var y = 0; y < data.bounds.height; y++) {
			for (var x = 0; x < data.bounds.width; x++) {
				ctx.fillStyle = data.data[y][x] ? "black" : "white";
				ctx.fillRect(x+dx, y+dy, 1, 1);
			}
		}
	}
}

// Get a U+xxxxx representation of a number.
function unicodeNumber(num) {
	var str = Number(num).toString(16);
	return "U+" + "0".repeat(5 - str.length) + str;
}



/* ==== Saving functions ==== */

// Select a glyph.
function selectGlyph(codepoint) {
	if (codepoint < 0) codepoint = 0;
	
	var strGlyph = String.fromCodePoint(codepoint);
	document.getElementById("glyph_text").value = strGlyph;
	document.getElementById("glyph_point").value = unicodeNumber(codepoint);
	glyph = codepoint;
	
	clearGrid();
	var data = glyphs[glyph];
	if (data) {
		glyphWidth = data.width;
		document.getElementById("glyph_width").value = glyphWidth;
		if (data.visible) {
			document.getElementById("glyph_width").value = glyphWidth;
			insertData(data.bounds.x, data.bounds.y, data.bounds.width, data.bounds.height, data.data);
		}
	}
	showGlyphOutlines(undefined);
}

// Calculates the actual filled in bounds of the glyph.
function getGlyphBounds() {
	var x0 =  Infinity, y0 =  Infinity;
	var x1 = -Infinity, y1 = -Infinity;
	for (var y = 0; y < gridHeight; y++) {
		for (var x = 0; x < gridWidth; x++) {
			if (!gridData[y][x]) continue;
			x0 = Math.min(x0, x);
			y0 = Math.min(y0, y);
			x1 = Math.max(x1, x);
			y1 = Math.max(y1, y);
		}
	}
	
	if (isFinite(x0) && isFinite(y0)) {
		return {
			x:      x0 + gridDx,
			y:      y0 + gridDy,
			width:  x1 - x0 + 1,
			height: y1 - y0 + 1
		};
	} else {
		return null;
	}
}

// Handles change events.
// Called when any of the glyph's parameters or data is changed.
function glyphChanged() {
	// Update the outlines, if applicable.
	showGlyphOutlines(undefined);
	
	// Make the glyph data.
	var dims = getGlyphBounds();
	var data;
	if (dims) {
		data = {
			glyph:   glyph,
			visible: true,
			bounds:  dims,
			width:   glyphWidth,
			data:    extractGridData(dims.x, dims.y, dims.width, dims.height),
		};
		
		if (!fontGlyphs) {
			fontGlyphs = [glyph];
			updateRanges();
		} else if (!fontGlyphs.includes(glyph)) {
			fontGlyphs = fontGlyphs.concat(glyph).sort((a, b) => a - b);
			updateRanges();
		}
	} else {
		data = {
			glyph:   glyph,
			visible: false,
			width:   glyphWidth,
		}
	}
	
	// Insert glyph data.
	glyphs[glyph] = data;
	saveData();
}

// Saves the current font to local storage.
function saveData() {
	// Update the save slot.
	if (saveSelElem.value != "unsaved") {
		if (!saveName) saveName = font;
		var key   = saveSelElem.value;
		var data  = exportData(saveName, true);
		localStorage.setItem(key, data);
	}
}

// Exports the font as JSON, optionally base64 encoded.
function exportData(name="Unnamed", doBase64=false) {
	var toExport = {
		url:          fontUrl,
		font:         font,
		name:         name,
		
		glyphs:       glyphs,
		glyphSel:	  glyph,
		glyphList:    fontGlyphs,
		glyphRanges:  fontRanges,
		glyphHeight:  glyphHeight,
		
		gridDx:       gridDx,
		gridDy:       gridDy,
		gridWidth:    gridWidth,
		gridHeight:   gridHeight,
		
		showGrid:     document.getElementById("show_grid").checked,
		showRuler:    document.getElementById("show_ruler").checked,
		showOutlines: document.getElementById("show_outlines").checked,
	};
	if (doBase64) {
		return btoa(JSON.stringify(toExport));
	} else {
		return JSON.stringify(toExport, undefined, "\t");
	}
}

// Imports the font from JSON, optionally base64 encoded.
function importData(input, doBase64=false) {
	// Import the funny data.
	var importData;
	if (doBase64) {
		importData = JSON.parse(atob(input));
	} else {
		importData = JSON.parse(input);
	}
	
	fontUrl     = importData.url,
	font        = importData.font,
	saveName    = importData.name,
	
	glyphs      = importData.glyphs;
	fontGlyphs  = importData.glyphList;
	fontRanges  = importData.glyphRanges;
	glyphHeight = importData.glyphHeight;
	
	gridDx      = importData.gridDx;
	gridDy      = importData.gridDy;
	gridWidth   = importData.gridWidth;
	gridHeight  = importData.gridHeight;
	
	document.getElementById("font_name").value       = importData.font;
	document.getElementById("font_url").value        = importData.url;
	
	document.getElementById("ruler_x").value         = -gridDx;
	document.getElementById("ruler_y").value         = -gridDy;
	document.getElementById("canvas_width").value    = gridWidth;
	document.getElementById("canvas_height").value   = gridHeight;
	
	document.getElementById("show_grid").checked     = importData.showGrid;
	document.getElementById("show_ruler").checked    = importData.showRuler;
	document.getElementById("show_outlines").checked = importData.showOutlines;
	
	gridElem.classList.remove("grid", "ruler");
	if (importData.showGrid) gridElem.classList.add("grid");
	if (importData.showRuler) gridElem.classList.add("ruler");
	
	resizeGrid(gridWidth, gridHeight);
	selectGlyph(importData.glyphSel);
	updateRanges();
}

// Called when the save slot dropdown changes.
function saveSlotSelected(elem, old_value="unsaved") {
	if (elem.value == "new_slot") {
		// Save to storage.
		var name  = prompt("Save font to new slot", font);
		if (!name) {
			elem.value = old_value;
			return;
		}
		
		var index;
		if ("num_fonts" in localStorage) {
			index = Number(localStorage.getItem("num_fonts"));
		} else {
			index = 0;
		}
		var key   = `fonts_${index}`;
		var data  = exportData(name, true);
		localStorage.setItem(key, data);
		localStorage.setItem("num_fonts", index + 1);
		saveName  = name;
		
		// Update the list.
		var optn       = document.createElement("option");
		optn.value     = key;
		optn.innerHTML = name;
		saveSelElem.options.add(optn);
		elem.value     = key;
	} else if (elem.value != "unsaved") {
		// Retrieve from storage.
		importData(localStorage.getItem(elem.value), true);
	}
	
	localStorage.setItem("font_selected", saveSelElem.value);
}

// Downloads your crappy string.
function downloadBase64(name, data) {
	var a = document.createElement("a");
	a.href = `data:application/octet-stream;charset=utf-8;base64,${btoa(data)}`;
	a.setAttribute("download", name);
	a.click();
}



/* ==== C/C++ data handling ==== */

// Converts raw glyph data to bytes.
function glyphToBytes(width, height, data) {
	var bytesPerLine = Math.ceil(width / 8);
	var out = Array(bytesPerLine * height);
	
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			var bitIndex  = x % 8;
			var byteIndex = Math.floor(x / 8) + bytesPerLine * y;
			out[byteIndex] |= data[y][x] * 1 << bitIndex;
		}
	}
	
	return out;
}

// Converts bytes to raw glyph data.
function glyphFromBytes(width, height, bytes) {
	var bytesPerLine = Math.ceil(width / 8);
	var out = Array(height);
	
	for (var y = 0; y < height; y++) {
		out[y] = Array(width);
		for (var x = 0; x < width; x++) {
			var bitIndex  = x % 8;
			var byteIndex = Math.floor(x / 8) + bytesPerLine * y;
			out[y][x]     = !!((bytes[byteIndex] >> bitIndex) & 1);
		}
	}
	
	return out;
}

// Converts an integer array to a C constant.
function intArrToC(type, name, data) {
	var out = `const ${type} ${name}[] = {\n\t`;
	for (index in data) {
		out += `${String(data[index])}, `;
	}
	out += `\n};\nconst size_t ${name}_len = sizeof(${name}) / sizeof(${type});\n`;
	return out;
}

// Converts a data/prototype pair to an anonymous C constant.
function objectToC(data, prototype, isConst=true) {
	if (prototype._typename === "__integer") {
		return parseInt(data);
	} else if (prototype._typename === "char*") {
		return JSON.stringify(String(data));
	}
	
	var out = `(${isConst?"const":""} ${prototype._typename}){`;
	
	for (var i = 0; i < prototype.fields.length; i++) {
		var key = prototype.fields[i].name;
		if (data[key]) {
			out += `.${key}=${objectToC(data[key])}`;
		}
	}
}

// Extracts an integer array from a C constant.
function intArrFromC(str) {
	var out = [];
	
	var start = str.indexOf('{');
	var end   = str.indexOf('}');
	console.log(str);
	
	while (str) {
		index = str.indexOf(',');
		if (index == -1) index = str.length;
		out = out.concat(Number(str.substring(0, index)));
		str = str.substring(index + 1);
	}
	
	return out;
}

// Exports the font as monospace, cropping anything outsize the box.
function exportMonospaceSimple(id, width, height) {
	var raw = '#include <pax_fonts.h>\n// Raw data.\n';
	
	// Start with outputting some ranges.
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		var bytes = [];
		for (var glyph = range.start; glyph <= range.end; glyph++) {
			selectGlyph(glyph);
			var data = extractGridData(0, 0, width, height);
			bytes = bytes.concat(glyphToBytes(width, height, data));
		}
		raw += intArrToC('uint8_t', `${id}_r${i}`, bytes);
	}
	
	// Create the combining parts.
	raw += `// Combined ranges.\nconst pax_font_range_t ${id}_ranges[] = {\n`;
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		raw +=
			`{ // Range ${i+1} / ${fontRanges.length}.\n`+
			`	.type  = PAX_FONT_BITMAP_MONO,\n`+
			`	.start = 0x${range.start.toString(16)},\n`+
			`	.end   = 0x${range.end.toString(16)},\n`+
			`	.bitmap_mono = {\n`+
			`		.glyphs = ${id}_r${i},\n`+
			`		.width  = ${width},\n`+
			`		.height = ${height},\n`+
			`	},`+
			`}, `;
	}
	raw += `\n};\nconst size_t ${id}_ranges_len = sizeof(${id}_ranges) / sizeof(pax_font_range_t);\n`;
	
	return raw;
}

// Exports the font as variable pitch.
function exportVariable(id, height) {
	var raw = '#include <pax_fonts.h>\n// Raw data.\n';
	
	// Start with outputting some ranges.
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		var indices = [];
		
		// Create some byte arrays.
		var bytes = [];
		for (var glyph = range.start; glyph <= range.end; glyph++) {
			var data = glyphs[glyph];
			indices = indices.concat(bytes.length);
			if (data.visible) {
				bytes = bytes.concat(glyphToBytes(data.bounds.width, data.bounds.height, data.data));
			}
		}
		raw += intArrToC('uint8_t', `${id}_r${i}`, bytes);
		
		// Then create the dimensions arrays.
		raw += `const pax_bmpv_t ${id}_r${i}_dims[] = {\n`;
		for (var glyph = range.start; glyph <= range.end; glyph++) {
			var data = glyphs[glyph];
			if (data.visible) {
			raw +=
				`{\n`+
				`	.draw_x         = ${data.bounds.x},\n`+
				`	.draw_y         = ${data.bounds.y},\n`+
				`	.draw_w         = ${data.bounds.width},\n`+
				`	.draw_h         = ${data.bounds.height},\n`+
				`	.measured_width = ${data.width},\n`+
				`	.index          = ${indices[glyph-range.start]},\n`+
				`}, `;
			} else {
			raw +=
				`{\n`+
				`	.draw_x         = 0,\n`+
				`	.draw_y         = 0,\n`+
				`	.draw_w         = 0,\n`+
				`	.draw_h         = 0,\n`+
				`	.measured_width = ${data.width},\n`+
				`	.index          = ${indices[glyph-range.start]},\n`+
				`}, `;
			}
		}
		raw += `\n};\n`;
	}
	
	// Create the combining parts.
	raw += `// Combined ranges.\nconst pax_font_range_t ${id}_ranges[] = {\n`;
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		raw +=
			`{ // Range ${i+1} / ${fontRanges.length}.\n`+
			`	.type  = PAX_FONT_BITMAP_VAR,\n`+
			`	.start = 0x${range.start.toString(16)},\n`+
			`	.end   = 0x${range.end.toString(16)},\n`+
			`	.bitmap_var = {\n`+
			`		.glyphs = ${id}_r${i},\n`+
			`		.dims   = ${id}_r${i}_dims,\n`+
			`		.height = ${height},\n`+
			`	},\n`+
			`}, `;
	}
	raw += `\n};\nconst size_t ${id}_ranges_len = sizeof(${id}_ranges) / sizeof(pax_font_range_t);\n`;
	
	return raw;
}
