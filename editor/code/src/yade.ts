import * as vscode from 'vscode';
import {Range} from 'vscode';
import * as child_process from 'child_process'
import {
	VersionedTextDocumentIdentifier
  } from "vscode-languageclient";

import {client} from './client'
import { GoalRequest } from "../lib/types";
import {infoReq} from "./goals"

// do not use this variable directly: instead, use launchYade()
let yadeProcess : child_process.ChildProcess | undefined

function launchYade():child_process.ChildProcess {
	if (yadeProcess !== undefined)
	   {return yadeProcess;}
	
	var cwdYade = '/home/ouguir/elm/diagram';
	var electronPath = cwdYade + "/node_modules/electron/dist/electron";
	
	yadeProcess = child_process.spawn(//"coreact-yade", [], 
	   electronPath, [cwdYade], 
	   {env:{...process.env, ELECTRON_RUN_AS_NODE: ''}, 
	   stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ]});
    yadeProcess.on('exit', signal => {yadeProcess = undefined})
	yadeProcess.on('message', message => {console.log("message recu: ");
      console.log(message);
	  handleMsg(message);
	});
	return yadeProcess;
}


function insertAt(text:string, position:vscode.Position) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return;}
  return editor.edit(editBuilder => {
      editBuilder.insert(position, text);
  });
}
function insertAtCursor(text:string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return;}
  return insertAt(text, editor.selection.active);
}
function insertAfterCursor(text:string){
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return;}
  let position = editor.selection.active;
  position = new vscode.Position(position.line, position.character+1)
  return insertAt(text, position);
}

// https://stackoverflow.com/questions/69671964/how-to-put-cursor-on-specified-line-in-vscode-editor-extension-programatically
function moveCursorLeft() {
  const editor = vscode.window.activeTextEditor;
  if (!editor)
     return false;
  const newSelections = [];

  for (const selection of editor.selections) {
      const oldCursorPosition = selection.start;
      const newCursorPosition = new vscode.Position(
          oldCursorPosition.line,
          Math.max(0, oldCursorPosition.character - 1)
      );
  
      // We set start & end to the same Position, so this is setting a cursor position,
      // not a selected range of text
      const newSelection = new vscode.Selection(newCursorPosition, newCursorPosition);
      newSelections.push(newSelection);
  }
  
  editor.selections = newSelections;
  return true;
}
function handleMsg(message:any) {
	if (!message.key) {
		return;
	}
	switch (message.key) {
		case 'incomplete-equation':			
      const editor = vscode.window.activeTextEditor;
      if (!editor) {return;}

			const startText = "eassert (yade : " + message.content + ").\n{\n"
      const endText = "\n}"
        + "\n (* execute command at the end of the line below *)"
        + "\n norm_graph_hyp yade.  ";
      insertAtCursor(startText + " ")?.then(function (b){
        if (!b)
          return;
        if (!moveCursorLeft())
          return;
        insertAfterCursor(endText);
        
      });
      // const curPosition = editor.selection.active;
      // let curLine = curPosition.line;
      // let curChar = curPosition.character;

      // const beforePosition = new vscode.Position(curLine, curChar);
      // const nextPosition = new vscode.Position(curLine, 1 + curChar)
      // editor.edit(editBuilder => {
      //     editBuilder.insert(curPosition, " ");
      //     editBuilder.insert(nextPosition, endText);
      //     editBuilder.insert(curPosition, startText);
      // });
    
      // insertAfterCursor(text);
			break;
    case 'generate-proof':
            insertAtCursor(message.content);
            break;
	}
}

function sendYade(key:String, content:any) {
	launchYade().send({key:key, content:content});
}

function findCoqScript(document : vscode.TextDocument, endLineNumber:number):
   {assertLine : number, startScript : number, endScript : number}
 {
    let lineNumber = endLineNumber;
    // console.log("line number: " + lineNumber);
    let lineTrimmed = "";
    while(lineTrimmed != "}") {
     lineNumber --;
    //  console.log("line number: " + lineNumber);
     lineTrimmed = document.lineAt(lineNumber).text.trim();
    }
    let endScriptNumber = lineNumber - 1;
    lineTrimmed = ""
    while(!lineTrimmed.startsWith("eassert (yade")) {
        lineNumber --;
        // console.log("line number: " + lineNumber);
        lineTrimmed = document.lineAt(lineNumber).text.trim();
    }
    let assertLineNumber = lineNumber;
    lineTrimmed = ""
    while(lineTrimmed != "{") {
        lineNumber ++;
        lineTrimmed = document.lineAt(lineNumber).text.trim();
    }
    return { assertLine : assertLineNumber, startScript : lineNumber + 1, endScript: endScriptNumber };
}

function sendNewEquation(editor:vscode.TextEditor) {
  let version = editor.document.version;
  let position = editor.selection.active;
  let line = editor.document.lineAt(position);
  let endLinePosition = line.range.end;
  let uri = editor.document.uri;
  let textDocument = VersionedTextDocumentIdentifier.create(
   uri.toString(),
   version
  );
  let strCursor: GoalRequest = {
   textDocument,
   position: endLinePosition,
   pp_format: "Str",
  };
 client.sendRequest(infoReq, strCursor).then(
   (goals) => { console.log(goals); 
       sendYade("load", goals.goals?.goals[0].ty);
       editor.edit(editBuilder => {
            editBuilder.delete(line.range);
       });
    },
   (reason) => console.log("error: " + reason)
 );
}

function findNextNormGraphHyp(editor:vscode.TextEditor):vscode.Position {
  let lineNumber = editor.selection.active.line;
  
  while(editor.document.lineAt(lineNumber).text.replaceAll(" ","") 
     != "norm_graph_hypyade.") {
    lineNumber ++;
  }
  return editor.document.lineAt(lineNumber).range.end;

}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activateYade(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "coreact-yade" is now active!');


	
	context.subscriptions.push(
		vscode.commands.registerCommand('coq-lsp.loadGraph', () => 
		    vscode.window
              .showInputBox()
              .then((expr) => 
			       expr && sendYade("load", expr)
			   ))		
	);

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand('coq-lsp.loadEquation', (editor) => 
		   {
          if (!client.isRunning()) return;
		      let uri = editor.document.uri;
		      let version = editor.document.version;
		      let position = editor.selection.active;
      
          if (editor.document.lineAt(position).text.replaceAll(" ","")
                == "norm_graph.") {
            sendNewEquation(editor);
            return;
          }
          // TODO: factor with sendNewEquation
          let normPosition = findNextNormGraphHyp(editor);
          let line = normPosition.line
          const {assertLine, startScript, endScript} = findCoqScript(editor.document, normPosition.line);
          let coqScript = editor.document.getText(new Range(startScript, 0, endScript + 1, 0));
          // remove the last newline character
          coqScript = coqScript.slice(0, -1);
          console.log("coq script: ") ;
          console.log(coqScript);
		      let textDocument = VersionedTextDocumentIdentifier.create(
             uri.toString(),
             version
           );
          let strCursor: GoalRequest = {
            textDocument,
            position: normPosition,
            pp_format: "Str",
          };
          client.sendRequest(infoReq, strCursor).then(
            (goals) => { console.log(goals); 
                var hyps = goals.goals?.goals[0].hyps;
                var eq = hyps![hyps!.length - 1].ty;
                // console.log(goals.goals?.stack);
                // var hyps = goals.goals?.stack[0][1][0].hyps;
                console.log(eq);
                sendYade("complete-equation", {statement:eq, script:coqScript});
                editor.edit(editBuilder => {
                    editBuilder.delete(new Range(assertLine, 0, line + 1, 0));
                });
             },
            (reason) => console.log("error: " + reason)
          );
     })
	);
	
}