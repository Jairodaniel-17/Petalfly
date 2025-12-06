import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-markup";

if (!Prism.languages.pfs) {
  Prism.languages.pfs = Prism.languages.yaml;
}

export default Prism;
