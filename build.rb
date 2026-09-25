# encoding: utf-8
#
# Builds ONE self-contained HTML file you can double-click.
#
# Why this exists: browsers refuse to load ES modules over file://, so
# the modular source under src/ needs a web server. That server dies
# with whatever terminal started it, and then the page loads from cache
# with no script attached and every button does nothing.
#
# So this flattens three.js, the stylesheet and all the modules into a
# single classic <script>. Classic scripts are not subject to CORS and
# nothing is fetched at run time, so the file works offline by being
# double-clicked, forever.
#
# TWO TRAPS, both of which bit:
#
#  1. Ruby's sub/gsub expand \0 \1 \` \' IN THE REPLACEMENT STRING.
#     three.js contains  can\'t  inside a JS string literal, so a plain
#     sub! spliced the rest of the HTML file into the middle of three
#     and produced a syntax error 138 KB in. Every substitution here
#     uses the BLOCK form, which treats the result as a literal.
#
#  2. Concatenating modules into one scope collides their top-level
#     helpers — three files declare `const clamp`, with DIFFERENT
#     signatures. So this is a real (tiny) bundler: each file keeps its
#     own scope in an IIFE and imports are rewired to its exports.
#
#   ruby build.rb   ->   "Fear and Loathing.html"

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

ROOT = File.dirname(File.expand_path(__FILE__))
read = ->(*p) { File.read(File.join(ROOT, *p), encoding: 'UTF-8') }

# TRAP 3: the shaders live in JS template literals, so a backtick typed
# inside a COMMENT ends the shader string and spills GLSL into JS. This
# cost a black screen and an error that pointed at a number, not a quote.
# Nothing in these files has any business containing a backtick except
# the template delimiters themselves, so any backtick on a comment line
# is a bug.
%w[src/post.js src/world.js src/suite.js src/desert.js src/mint.js src/convention.js src/npc.js src/main.js src/game.js src/audio.js src/touch.js].each do |f|
  read.call(f).each_line.with_index(1) do |line, n|
    next unless line =~ %r{^\s*(//|/\*|\*)}
    abort "#{f}:#{n} backtick in a comment would end a shader string:\n  #{line.strip}" if line.include?('`')
  end
end


# main.js runs on load, so it goes last
SOURCES = %w[audio.js post.js world.js suite.js desert.js mint.js convention.js npc.js game.js touch.js main.js]
modname = ->(f) { '__m_' + File.basename(f, '.js') }

def module_wrap(file, src, modname)
  exports = []

# src/main.js carries a DOM-backed dev channel used to drive the game from
# outside the page while testing. It is inert without a data-fl-debug
# attribute, but the shipped file has no business carrying it.
src = src.gsub(/^[ \t]*\/\* DBG-START \*\/.*?^[ \t]*\/\* DBG-END \*\/[ \t]*\n/m) { '' }
  lines = src.lines.map do |line|
    case line
    when /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]three['"];?\s*$/
      "const #{$1} = window.THREE;\n"
    when /^import\s*\{([^}]*)\}\s*from\s*['"]\.\/([\w.]+)\.js['"];?\s*$/
      names, dep = $1, $2
      "const { #{names.strip} } = #{modname.call(dep)};\n"
    when /^import\s+[^;]*;\s*$/
      "\n"
    when /^export\s+(class|function|const|let|var)\s+(\w+)/
      exports << $2
      line.sub(/^export\s+/, '')
    when /^export\s*\{([^}]*)\};?\s*$/
      exports.concat($1.split(',').map { |n| n.split(/\s+as\s+/).last.strip })
      "\n"
    else
      line
    end
  end

  sep = '=' * 58
  body = lines.join
  <<~JS
    /* #{sep}
       #{file}
       #{sep} */
    var #{modname.call(File.basename(file, '.js'))} = (function(){
    #{body}
    return { #{exports.uniq.join(', ')} };
    })();
  JS
end

game = SOURCES.map { |f| module_wrap(f, read.call('src', f), modname) }.join("\n")

# --- three.js: module -> plain global -------------------------------
three = read.call('vendor', 'three.module.js')
unless three.sub!(/^export\s*\{([^}]*)\};?\s*$/) { "return { #{$1} };" }
  abort 'could not find the three.js export statement'
end
three = "window.THREE = (function(){\n#{three}\n})();\n"

# --- stitch the page together (block form everywhere) ---------------
html = read.call('index.html')
css  = read.call('css', 'ui.css')

# the stylesheet's first line reaches out to Google Fonts. Swap it for
# the base64'd faces so the finished file needs nothing from a network.
fonts = File.join(ROOT, 'vendor', 'fonts', 'fonts.css')
if File.exist?(fonts)
  embedded = File.read(fonts, encoding: 'UTF-8')
  abort 'fonts.css has no @font-face' unless embedded.include?('@font-face')
  css = css.sub(/^@import url\([^)]*\);[ \t]*\n?/) { embedded + "\n" }
else
  warn 'vendor/fonts/fonts.css missing — built file will want the network for fonts'
end

html.sub!(%r{<link rel="stylesheet" href="css/ui\.css"\s*/?>}) { "<style>\n#{css}\n</style>" }
html.sub!(%r{<script type="importmap">.*?</script>\s*}m) { '' }
html.sub!(%r{<script type="module" src="src/main\.js"></script>}) do
  "<script>\n#{three}\n</script>\n<script>\n#{game}\n</script>"
end

out = File.join(ROOT, 'Fear and Loathing.html')
File.write(out, html)

# a corrupted bundle is worse than none: fail loudly
if File.read(out, encoding: 'UTF-8').include?('</body>' + "\n" + '<')
  # harmless on its own, but check three survived intact
end
%w[Object3D.add WebGLRenderer buildWorld class Game].each do |needle|
  abort "bundle looks truncated — #{needle} missing" unless File.read(out, encoding: 'UTF-8').include?(needle)
end
puts "wrote #{File.basename(out)} — #{(File.size(out) / 1024.0 / 1024.0).round(2)} MB, no network needed"
