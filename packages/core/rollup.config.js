import { dts, ts } from "rollup-plugin-dts";

const pkg = require("./package.json");

const banner = [].join("\n");
const input = "src/index.ts";
const external = Object.keys(pkg.dependencies)
  .concat(["events"]);

export default [
  // main
  {
    input,
    plugins: [
      ts({
        compilerOptions: {
          removeComments: true,
        },
      }),
    ],
    external,
    output: [
      {
        banner,
        file: pkg.main,
        format: "cjs",
      },
      {
        banner,
        file: pkg.module,
        format: "es",
      }
    ]
  },
  // lib
  {
    input,
    plugins: [
      dts(),
    ],
    external,
    output: [
      {
        banner,
        file: pkg.types,
        format: "es",
      }
    ]
  },
];