# encoding: utf-8
#
# Turns the Google Fonts stylesheet into a self-contained one with the
# WOFF2 files base64'd straight into it. Keeps only the latin subset,
# which is all this game writes in, so the page carries about 60 KB of
# font instead of reaching out to the network for it.
#
#   ruby vendor/fonts/embed.rb   ->   vendor/fonts/fonts.css

require 'base64'
require 'open-uri'

Encoding.default_external = Encoding::UTF_8

HERE = File.dirname(File.expand_path(__FILE__))
src  = File.read(File.join(HERE, 'google.css'), encoding: 'UTF-8')

blocks = src.scan(/@font-face\s*\{[^}]*\}/m)
kept = blocks.select { |b| b.include?('U+0000-00FF') }   # latin
abort 'no latin blocks found' if kept.empty?

out = kept.map do |block|
  url = block[%r{url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)}, 1]
  next block unless url
  data = URI.open(url, 'User-Agent' => 'Mozilla/5.0').read
  b64 = Base64.strict_encode64(data)
  warn "  #{url.split('/')[-2]}  #{(data.bytesize / 1024.0).round(1)} KB"
  block.sub(/url\([^)]+\)/, "url(data:font/woff2;base64,#{b64})")
end

File.write(File.join(HERE, 'fonts.css'), out.join("\n"))
puts "wrote fonts.css — #{(File.size(File.join(HERE, 'fonts.css')) / 1024.0).round(1)} KB, #{kept.size} faces"
