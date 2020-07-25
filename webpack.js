const fs = require("fs");
const path = require("path");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");

const getModuleInfo = (file) => {
  // 入口文件内容 ./src/index.js
  const body = fs.readFileSync(file, "utf-8");
  console.log("body :>> \n", body);

  // 根据 body 解析到的 ast
  const ast = parse(body, {
    sourceType: "module", //表示我们要解析的是ES模块
  });
  console.log("ast :>> ", ast.program.body);

  console.log("--------------deps :>> ");
  const deps = {};

  // 根据 ast 解析依赖
  traverse(ast, {
    ImportDeclaration({ node }) {
      console.log("node :>> ", node);
      // 目录
      const dirname = path.dirname(file);
      console.log("dirname :>> ", dirname);

      // 绝对路径
      const abspath = "./" + path.join(dirname, node.source.value);
      console.log("abspath :>> ", abspath);

      // 放入 deps 中
      deps[node.source.value] = abspath;
    },
  });
  console.log("deps :>> ", deps);

  // 将es6转换为es5
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  });

  console.log("code :>> \n", code);

  // 返回处理的结果
  const moduleInfo = { file, deps, code };
  return moduleInfo;
};

// 解析依赖
parseModules = (file) => {
  // 用于存放解析结果的对象
  const depsGraph = {};

  const _parseModules = (file) => {
    const { file: moduleFile, deps, code } = getModuleInfo(file);

    depsGraph[moduleFile] = {
      deps,
      code,
    };

    if (deps) {
      for (const dep in deps) {
        if (deps.hasOwnProperty(dep)) {
          // 递归解析依赖
          _parseModules(deps[dep]);

          // const { file, ...tempInfo } = getModuleInfo(deps[dep]);
          // depsGraph[file] = {
          //   ...tempInfo,
          // };
        }
      }
    }
  };

  _parseModules(file);
  // 返回解析后的结果
  return depsGraph;
};

parseModules("./src/index.js");

// 添加 require 及 exports 关键字
const bundle = (file) => {
  const depsGraph = JSON.stringify(parseModules(file));
  return `(function (graph) {
        function require(file) {

            // 定义用于获取绝对路径的require
            function absRequire(relPath) {
                return require(graph[file].deps[relPath])
            }
            // 定义 exports 关键字
            var exports = {};

            // 传入绝对路径的require
            (function (require,exports={},code) {
                eval(code)
            })(absRequire,exports,graph[file].code)

            return exports
        }
        require('${file}')
    })(${depsGraph})`;
};

const content = bundle("./src/index.js");

// 写入到我们的dist目录下
!fs.readdirSync("./dist").length && fs.mkdirSync("./dist");
fs.writeFileSync("./dist/bundle.js", content);
