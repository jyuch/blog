import lume from "lume/mod.ts";
import date from "lume/plugins/date.ts";
import codeHighlight from "lume/plugins/code_highlight.ts";
import basePath from "lume/plugins/base_path.ts";
import slugifyUrls from "lume/plugins/slugify_urls.ts";
import resolveUrls from "lume/plugins/resolve_urls.ts";
import pageFind from "lume/plugins/pagefind.ts";
import sass from "lume/plugins/sass.ts";
import minifyHTML from "lume/plugins/minify_html.ts";
import nunjucks from "lume/plugins/nunjucks.ts";

const site = lume({
  location: new URL("https://www.jyuch.dev/"),
});

site
  .ignore("README.md")
  .copy("img")
  .copy("favicon.ico")
  .copy("CNAME")
  .use(date())
  .use(codeHighlight())
  .use(basePath())
  .use(pageFind({
    ui: {
      resetStyles: false,
    },
  }))
  .use(slugifyUrls({ alphanumeric: false, lowercase: false }))
  .use(resolveUrls())
  .use(sass())
  .use(nunjucks())
  .use(minifyHTML())
  .add([".scss"]);

export default site;
