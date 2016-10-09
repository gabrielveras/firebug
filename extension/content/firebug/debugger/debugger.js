/* See license.txt for terms of usage */
/*jshint noempty:false, esnext:true, curly:false, unused:false*/
/*global define:1*/

define([
    "firebug/firebug",
    "firebug/lib/trace",
    "firebug/lib/object",
    "firebug/lib/locale",
    "firebug/lib/options",
    "firebug/chrome/firefox",
    "firebug/chrome/tabWatcher",
    "firebug/chrome/activableModule",
    "firebug/debugger/breakpoints/breakpointStore",
    "firebug/debugger/debuggerHalter",
    "firebug/debugger/debuggerLib",
    "firebug/debugger/clients/clientCache",
    "firebug/remoting/debuggerClient",
],
function(Firebug, FBTrace, Obj, Locale, Options, Firefox, TabWatcher, ActivableModule,
    BreakpointStore, DebuggerHalter, DebuggerLib, ClientCache, DebuggerClient) {

"use strict";

// ********************************************************************************************* //
// Constants

var Trace = FBTrace.to("DBG_DEBUGGER");
var TraceError = FBTrace.toError();

/*** SWARM DEBUGGER - BEGIN ***/
window.oProduct = { name : "FireSwarm" };

window.oDeveloper = { color : "FF0000",
                      name  : "gabrielveras" };

window.oTask = { color   : "FF0000",
                 title   : "TODO",
                 url     : "TODO",
                 product : null } ;

window.oSession = { description : "FireSwarm",
                    finished    : null,
                    label       : "FireSwarm",
                    project     : "FireSwarm",
                    purpose     : "FireSwarm",
                    started     : null,
                    developer   : null,
                    task        : null };

window.oType = { fullName  : "FireSwarm",
                 fullPath  : "FireSwarm",
                 name      : "FireSwarm",
                 source    : "FireSwarm",
                 namespace : null,
                 session   : null };

window.oBreakpoint = { charEnd    : "FireSwarm",
                       charStart  : "FireSwarm",
                       lineNumber : 0,
                       type       : null };
/*** SWARM DEBUGGER - END ***/

// ********************************************************************************************* //
// Implementation

/**
 * @module
 */
Firebug.Debugger = Obj.extend(ActivableModule,
/** @lends Firebug.Debugger */
{
    dispatchName: "Debugger",

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Initialization

    initialize: function()
    {
/*** SWARM DEBUGGER - BEGIN ***/
        // CREATE DEVELOPER
        var oRequestDeveloper = new XMLHttpRequest();
        oRequestDeveloper.onload = function() { window.oDeveloper = JSON.parse(oRequestDeveloper.responseText); };
        oRequestDeveloper.open("POST", "http://localhost:8080/developers/");
        oRequestDeveloper.setRequestHeader("Content-Type", "application/json");
        oRequestDeveloper.send(JSON.stringify(window.oDeveloper));
        // CREATE PRODUCT
        var oRequestProduct = new XMLHttpRequest();
        oRequestProduct.onload = function() { window.oProduct = JSON.parse(oRequestProduct.responseText); };
        oRequestProduct.open("POST", "http://localhost:8080/products/");
        oRequestProduct.setRequestHeader("Content-Type", "application/json");
        oRequestProduct.send(JSON.stringify(window.oProduct));
        // CREATE TASK
        var fWaitProduct = function() {
            if (typeof window.oProduct.id !== "undefined") {
                var oRequestTask = new XMLHttpRequest();
                oRequestTask.onload = function() {
                    window.oTask = JSON.parse(oRequestTask.responseText);
                    window.oTask.product = window.oProduct._links.self.href;
                };
                oRequestTask.open("POST", "http://localhost:8080/tasks/");
                oRequestTask.setRequestHeader("Content-Type", "application/json");
                window.oTask.product = window.oProduct._links.self.href;
                oRequestTask.send(JSON.stringify(window.oTask));
            } else {
                setTimeout(function() { fWaitProduct(); }, 250);
            }
        }
        fWaitProduct();
        // CREATE SESSION
        var fWaitDeveloperAndTask = function() {
            if ((typeof window.oDeveloper.id !== "undefined") && (typeof window.oTask.id !== "undefined")) {
                var oRequestSession = new XMLHttpRequest();
                oRequestSession.onload = function() {
                    window.oSession = JSON.parse(oRequestSession.responseText);
                    window.oSession.developer = window.oDeveloper._links.self.href;
                    window.oSession.task = window.oTask._links.self.href;
                };
                oRequestSession.open("POST", "http://localhost:8080/sessions/");
                oRequestSession.setRequestHeader("Content-Type", "application/json");
                window.oSession.started = (new Date()).toISOString();
                window.oSession.developer = window.oDeveloper._links.self.href;
                window.oSession.task = window.oTask._links.self.href;
                oRequestSession.send(JSON.stringify(window.oSession));
            } else {
                setTimeout(function() { fWaitDeveloperAndTask(); }, 250);
            }
        }
        fWaitDeveloperAndTask();
/*** SWARM DEBUGGER - END ***/
        ActivableModule.initialize.apply(this, arguments);

        // xxxHonza: scoped logging should automate this (see firebug/lib/trace module).
        Firebug.registerTracePrefix("debuggerTool.", "DBG_DEBUGGERTOOL", false);
        Firebug.registerTracePrefix("sourceTool.", "DBG_SOURCETOOL", false);
        Firebug.registerTracePrefix("breakpointTool.", "DBG_BREAKPOINTTOOL", false);

        // Listen to the main client, which represents the connection to the server.
        // The main client object sends various events about attaching/detaching
        // progress to the backend.
        DebuggerClient.addListener(this);

        // Hook XUL stepping buttons.
        var chrome = Firebug.chrome;
        chrome.setGlobalAttribute("cmd_firebug_rerun", "oncommand",
            "Firebug.Debugger.rerun(Firebug.currentContext)");
        chrome.setGlobalAttribute("cmd_firebug_resumeExecution", "oncommand",
            "Firebug.Debugger.resume(Firebug.currentContext)");
        chrome.setGlobalAttribute("cmd_firebug_stepOver", "oncommand",
            "Firebug.Debugger.stepOver(Firebug.currentContext)");
        chrome.setGlobalAttribute("cmd_firebug_stepInto", "oncommand",
            "Firebug.Debugger.stepInto(Firebug.currentContext)");
        chrome.setGlobalAttribute("cmd_firebug_stepOut", "oncommand",
            "Firebug.Debugger.stepOut(Firebug.currentContext)");

        // Set tooltips for stepping buttons.
        var setTooltip = function(id, tooltip, shortcut)
        {
            tooltip = Locale.$STRF("firebug.labelWithShortcut", [Locale.$STR(tooltip), shortcut]);
            Firebug.chrome.$(id).setAttribute("tooltiptext", tooltip);
        };

        // Commented until Debugger.Frame.prototype.replaceCall is implemented.
        // See issue 6789 + bugzilla #976708.
        // setTooltip("fbRerunButton", "script.Rerun", "Shift+F8");
        setTooltip("fbContinueButton", "script.Continue", "F8");
        setTooltip("fbStepIntoButton", "script.Step_Into", "F11");
        setTooltip("fbStepOverButton", "script.Step_Over", "F10");
        setTooltip("fbStepOutButton", "script.Step_Out", "Shift+F11");
    },

    initializeUI: function()
    {
        ActivableModule.initializeUI.apply(this, arguments);

        // TODO move to script.js
        this.filterButton = Firebug.chrome.$("fbScriptFilterMenu");
        this.filterMenuUpdate();
    },

    shutdown: function()
    {
/*** SWARM DEBUGGER - BEGIN ***/
        // FINISH SESSION
        var oRequestSession = new XMLHttpRequest();
        oRequestSession.onload = function() {
            window.oSession = JSON.parse(oRequestSession.responseText);
            window.oSession.developer = window.oDeveloper._links.self.href;
            window.oSession.task = oTask._links.self.href;
        };
        oRequestSession.open("POST", "http://localhost:8080/sessions/");
        oRequestSession.setRequestHeader("Content-Type", "application/json");
        window.oSession.finished = (new Date()).toISOString();
        oRequestSession.send(JSON.stringify(window.oSession));
/*** SWARM DEBUGGER - END ***/
        Firebug.unregisterTracePrefix("debuggerTool.");
        Firebug.unregisterTracePrefix("breakpointTool.");

        DebuggerClient.removeListener(this);

        ActivableModule.shutdown.apply(this, arguments);
    },

    initContext: function(context, persistedState)
    {
        Trace.sysout("debugger.initContext; context ID: " + context.getId());

        // If page reload happens the thread client remains the same so,
        // preserve also all existing breakpoint clients.
        // See also {@link DebuggerClient#initConext}
        if (persistedState)
        {
            context.breakpointClients = persistedState.breakpointClients;
        }
    },

    showContext: function(browser, context)
    {
        // xxxHonza: see TabWatcher.unwatchContext
        if (!context)
            return;

        Trace.sysout("debugger.showContext; context ID: " + context.getId());
    },

    destroyContext: function(context, persistedState, browser)
    {
        Trace.sysout("debugger.destroyContext; context ID: " + context.getId());

        persistedState.breakpointClients = context.breakpointClients;
    },

    closeFirebug: function(context)
    {
        Trace.sysout("debugger.closeFirebug; context ID: " + context.getId());

        // Do not persist breakpoint client object across Firebug
        // shutdown/open. The RDP connection is closed on shutdown and
        // all client objects need to be recreated (they are valid only
        // across page refreshes).
        // (see issue 6901 and issue 7496)
        context.persistedState.breakpointClients = null;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // DebuggerClient

    onTabAttached: function(browser, reload)
    {
        var enabled = Firebug.Debugger.isAlwaysEnabled();

        Trace.sysout("debugger.onTabAttached; reload: " + reload);

        // Do not attach the threadClient if the Script panel is disabled. Attaching to the
        // thread client enables Debugger() for the current page, which consequently disables
        // JIT compilation.
        if (!Firebug.Debugger.isAlwaysEnabled())
            return;

        // The thread doesn't have to be attached again if the page/tab has
        // been just reloaded. The life time of the threadActor is the same
        // as the life time of the tab.
        if (reload)
            return;

        var tab = DebuggerClient.getTabClient(browser);
        if (tab)
            tab.attachThread();
    },

    onTabDetached: function(browser)
    {
        Trace.sysout("debugger.onTabDetached;");

        var tab = DebuggerClient.getTabClient(browser);
        if (tab)
            tab.detachThread();
    },

    onThreadAttached: function(context, reload)
    {
        Trace.sysout("debugger.onThreadAttached; reload: " + reload + ", context ID: " +
            context.getId(), context);

        // Create grip cache
        context.clientCache = new ClientCache(DebuggerClient.client, context);

        // Debugger has been attached to the remote thread actor, so attach also tools
        // needed by this module.
        context.getTool("source").attach(reload);
        context.getTool("debugger").attach(reload);
        context.getTool("breakpoint").attach(reload);
    },

    onThreadDetached: function(context)
    {
        Trace.sysout("debugger.onThreadDetached; context ID: " + context.getId());

        context.getTool("source").detach();
        context.getTool("debugger").detach();
        context.getTool("breakpoint").detach();
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // ActivableModule

    onObserverChange: function(observer)
    {
        if (this.hasObservers())
            this.activateDebugger();
        else
            this.deactivateDebugger();
    },

    activateDebugger: function()
    {
        if (this.activated)
            return;

        this.activated = true;

        Trace.sysout("debugger.activateDebugger;");

        // Iterate all contexts and make sure they are all attached to the current thread.
        // xxxHonza: it's always a bit hacky to explicitly iterate all contexts. Could we
        // rather dispatch a message to an object that is created for every context?
        TabWatcher.iterateContexts(function(context)
        {
            // Attach to the current thread. If the tab-attach sequence (that must happen
            // before) is currently in progress the {@link TabClient} object sets a flag
            // and will attach the thread as soon as the tab is attached.
            // If there is no instance of {@link TabClient} for the current browser,
            // the tab-attach sequence didn't started yet.
            var tab = DebuggerClient.getTabClient(context.browser);
            if (tab)
                tab.attachThread();
        });

        this.setStatus(true);
    },

    deactivateDebugger: function()
    {
        if (!this.activated)
            return;

        this.activated = false;

        Trace.sysout("debugger.deactivateDebugger;");

        // xxxHonza: again, it's a bit hacky to explicitly iterate all contexts.
        TabWatcher.iterateContexts(function(context)
        {
            var tab = DebuggerClient.getTabClient(context.browser);
            if (tab)
                tab.detachThread();
        });

        this.setStatus(false);
    },

    onSuspendFirebug: function()
    {
        if (!Firebug.Debugger.isAlwaysEnabled())
            return;

        Trace.sysout("debugger.onSuspendFirebug;");

        this.setStatus(false);

        return false;
    },

    onResumeFirebug: function()
    {
        if (!Firebug.Debugger.isAlwaysEnabled())
            return;

        Trace.sysout("debugger.onResumeFirebug;");

        this.setStatus(true);
    },

    setStatus: function(enable)
    {
        var status = Firefox.getElementById("firebugStatus");
        if (status)
        {
            var enabled = this.isEnabled() && enable;
            status.setAttribute("script", enabled ? "on" : "off");

            Trace.sysout("debugger.setStatus; enabled: " + enabled);
        }
        else
        {
            TraceError.sysout("debugger.setStatus; ERROR no firebugStatus element");
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Breakpoints

    setBreakpoint: function(sourceFile, lineNo)
    {
    },

    clearBreakpoint: function(sourceFile, lineNo)
    {
    },

    setErrorBreakpoint: function(compilationUnit, line)
    {
    },

    clearErrorBreakpoint: function(compilationUnit, line)
    {
    },

    clearAllBreakpoints: function(context, callback)
    {
        // xxxHonza: at some point we might want to remove only breakpoints created
        // for given context. This must be supported by the {@link BreakpointStore}

        // Remove all breakpoints from all contexts.
        BreakpointStore.removeAllBreakpoints(callback);
    },

    enableAllBreakpoints: function(context, callback)
    {
    },

    disableAllBreakpoints: function(context, callback)
    {
    },

    getBreakpointCount: function(context, callback)
    {
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Tracing (see issue 6220)

    traceAll: function(context)
    {
    },

    untraceAll: function(context)
    {
    },

    traceCalls: function(context, fn)
    {
    },

    untraceCalls: function(context, fn)
    {
    },

    traceScriptCalls: function(context, script)
    {
    },

    untraceScriptCalls: function(context, script)
    {
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Debugging

    rerun: function(context)
    {
        context.getTool("debugger").rerun();
    },

    resume: function(context)
    {
        context.getTool("debugger").resume();
    },

    abort: function(context)
    {
    },

    stepOver: function(context)
    {
        context.getTool("debugger").stepOver();
    },

    stepInto: function(context)
    {
        context.getTool("debugger").stepInto();
/*** SWARM DEBUGGER - BEGIN ***/
// CREATE NAMESPACE [INVOKING]
window.oNamespaceInvoking = { fullPath : "FireSwarm - Invoking",
                              name     : "FireSwarm - Invoking" };
var fPostNamespaceInvoking = function() {
    var oRequestNamespaceInvoking = new XMLHttpRequest();
    oRequestNamespaceInvoking.onload = function() { window.oNamespaceInvoking = JSON.parse(oRequestNamespaceInvoking.responseText); };
    oRequestNamespaceInvoking.open("POST", "http://localhost:8080/namespaces/");
    oRequestNamespaceInvoking.setRequestHeader("Content-Type", "application/json");
    oRequestNamespaceInvoking.send(JSON.stringify(window.oNamespaceInvoking));
}
fPostNamespaceInvoking();
// CREATE TYPE [INVOKING]
window.oTypeInvoking = { fullName : "FireSwarm - Invoking",
                         fullPath : "FireSwarm - Invoking",
                         name     : "FireSwarm - Invoking",
                         source   : "FireSwarm - Invoking" };
var fWaitNamespaceAndSessionInvoking = function() {
    if ((typeof window.oNamespaceInvoking.id !== "undefined") && (typeof window.oSession.id !== "undefined")) {
        var oRequestTypeInvoking = new XMLHttpRequest();
        oRequestTypeInvoking.onload = function() {
            window.oTypeInvoking = JSON.parse(oRequestTypeInvoking.responseText);
            window.oTypeInvoking.type = window.oNamespaceInvoking._links.self.href;
            window.oTypeInvoking.session = window.oSession._links.self.href;
        };
        oRequestTypeInvoking.open("POST", "http://localhost:8080/types/");
        oRequestTypeInvoking.setRequestHeader("Content-Type", "application/json");
        window.oTypeInvoking.namespace = window.oNamespaceInvoking._links.self.href;
        window.oTypeInvoking.session = window.oSession._links.self.href;
        oRequestTypeInvoking.send(JSON.stringify(window.oTypeInvoking));
    } else {
        setTimeout(function() { fWaitNamespaceAndSessionInvoking(); }, 250);
    }
}
fWaitNamespaceAndSessionInvoking();
// CREATE METHOD [INVOKING]
window.oMethodInvoking = { key       : "FireSwarm - Invoking",
                           name      : "FireSwarm - Invoking",
                           signature : "FireSwarm - Invoking" };
var fWaitTypeInvoking = function() {
    if (typeof window.oTypeInvoking.id !== "undefined") {
        var oRequestMethodInvoking = new XMLHttpRequest();
        oRequestMethodInvoking.onload = function() {
            window.oMethodInvoking = JSON.parse(oRequestMethodInvoking.responseText);
            window.oMethodInvoking.type = window.oTypeInvoking._links.self.href;
        };
        oRequestMethodInvoking.open("POST", "http://localhost:8080/methods/");
        oRequestMethodInvoking.setRequestHeader("Content-Type", "application/json");
        window.oMethodInvoking.type = window.oTypeInvoking._links.self.href;
        oRequestMethodInvoking.send(JSON.stringify(window.oMethodInvoking));
    } else {
        setTimeout(function() { fWaitTypeInvoking(); }, 250);
    }
}
fWaitTypeInvoking();
// CREATE NAMESPACE [INVOKED]
window.oNamespaceInvoked = { fullPath : "FireSwarm - Invoked",
                             name     : "FireSwarm - Invoked" };
var fPostNamespaceInvoked = function() {
    var oRequestNamespaceInvoked = new XMLHttpRequest();
    oRequestNamespaceInvoked.onload = function() { window.oNamespaceInvoked = JSON.parse(oRequestNamespaceInvoked.responseText); };
    oRequestNamespaceInvoked.open("POST", "http://localhost:8080/namespaces/");
    oRequestNamespaceInvoked.setRequestHeader("Content-Type", "application/json");
    oRequestNamespaceInvoked.send(JSON.stringify(window.oNamespaceInvoked));
}
fPostNamespaceInvoked();
// CREATE TYPE [INVOKED]
window.oTypeInvoked = { fullName : "FireSwarm - Invoked",
                        fullPath : "FireSwarm - Invoked",
                        name     : "FireSwarm - Invoked",
                        source   : "FireSwarm - Invoked" };
var fWaitNamespaceAndSessionInvoked = function() {
    if ((typeof window.oNamespaceInvoked.id !== "undefined") && (typeof window.oSession.id !== "undefined")) {
        var oRequestTypeInvoked = new XMLHttpRequest();
        oRequestTypeInvoked.onload = function() {
            window.oTypeInvoked = JSON.parse(oRequestTypeInvoked.responseText);
            window.oTypeInvoked.type = window.oNamespaceInvoked._links.self.href;
            window.oTypeInvoked.session = window.oSession._links.self.href;
        };
        oRequestTypeInvoked.open("POST", "http://localhost:8080/types/");
        oRequestTypeInvoked.setRequestHeader("Content-Type", "application/json");
        window.oTypeInvoked.namespace = window.oNamespaceInvoked._links.self.href;
        window.oTypeInvoked.session = window.oSession._links.self.href;
        oRequestTypeInvoked.send(JSON.stringify(window.oTypeInvoked));
    } else {
        setTimeout(function() { fWaitNamespaceAndSessionInvoked(); }, 250);
    }
}
fWaitNamespaceAndSessionInvoked();
// CREATE METHOD [INVOKED]
window.oMethodInvoked = { key       : "FireSwarm - Invoked",
                          name      : "FireSwarm - Invoked",
                          signature : "FireSwarm - Invoked" };
var fWaitTypeInvoked = function() {
    if (typeof window.oTypeInvoked.id !== "undefined") {
        var oRequestMethodInvoked = new XMLHttpRequest();
        oRequestMethodInvoked.onload = function() {
            window.oMethodInvoked = JSON.parse(oRequestMethodInvoked.responseText);
            window.oMethodInvoked.type = window.oTypeInvoked._links.self.href;
        };
        oRequestMethodInvoked.open("POST", "http://localhost:8080/methods/");
        oRequestMethodInvoked.setRequestHeader("Content-Type", "application/json");
        window.oMethodInvoked.type = window.oTypeInvoked._links.self.href;
        oRequestMethodInvoked.send(JSON.stringify(window.oMethodInvoked));
    } else {
        setTimeout(function() { fWaitTypeInvoked(); }, 250);
    }
}
fWaitTypeInvoked();
// CREATE INVOCATION
window.oInvocation = {};
var fWaitMethodsAndSession = function() {
    if ((typeof window.oMethodInvoking.id !== "undefined") && (typeof window.oMethodInvoked.id !== "undefined") && (typeof window.oSession.id !== "undefined")) {
        var oRequestInvocation = new XMLHttpRequest();
        oRequestInvocation.onload = function() {
            window.oInvocation = JSON.parse(oRequestInvocation.responseText);
            window.oInvocation.invoking = window.oMethodInvoking._links.self.href;
            window.oInvocation.invoked = window.oMethodInvoked._links.self.href;
            window.oInvocation.session = window.oSession._links.self.href;
        };
        oRequestInvocation.open("POST", "http://localhost:8080/invocations/");
        oRequestInvocation.setRequestHeader("Content-Type", "application/json");
        window.oInvocation.invoking = window.oMethodInvoking._links.self.href;
        window.oInvocation.invoked = window.oMethodInvoked._links.self.href;
        window.oInvocation.session = window.oSession._links.self.href;
        oRequestInvocation.send(JSON.stringify(window.oInvocation));
    } else {
        setTimeout(function() { fWaitMethodsAndSession(); }, 250);
    }
}
fWaitMethodsAndSession();
/*** SWARM DEBUGGER - END ***/
    },

    stepOut: function(context)
    {
        context.getTool("debugger").stepOut();
    },

    suspend: function(context)
    {
    },

    unSuspend: function(context)
    {
    },

    runUntil: function(context, compilationUnit, lineNo)
    {
        context.getTool("debugger").runUntil(compilationUnit, lineNo);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

    freeze: function(context)
    {
    },

    suppressEventHandling: function(context)
    {
    },

    thaw: function(context)
    {
    },

    unsuppressEventHandling: function(context)
    {
    },

    toggleFreezeWindow: function(context)
    {
    },

    doToggleFreezeWindow: function(context)
    {
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

    halt: function(fnOfFrame)
    {
    },

    breakAsIfDebugger: function(frame)
    {
        // Used by FBTest
    },

    /**
     * Breaks the debugger in the newest frame (if any) or in the debuggee global.
     *
     * @param {*} context
     */
    breakNow: function(context)
    {
        DebuggerHalter.breakNow(context);
    },

    stop: function(context, frame, type, rv)
    {
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Evaluation

    // xxxHonza: this entire methods should share API with the CommandLine if possible.
    evaluate: function(js, context, scope)
    {
        Trace.sysout("debugger.evaluate; " + js, scope);

        var currentFrame = context.currentFrame;
        if (!currentFrame)
            return;

        var threadActor = DebuggerLib.getThreadActor(context.browser);
        var frameActor = currentFrame.getActor();
        var frame = threadActor._requestFrame(frameActor);

        try
        {
            var result;

            var dbgGlobal = frame.script.global;
            scope = dbgGlobal.makeDebuggeeValue(scope);

            if (scope)
                result = frame.evalWithBindings(js, scope);
            else
                result = frame.eval(js);

            Trace.sysout("debugger.evaluate; RESULT:", result);

            if (result.hasOwnProperty("return"))
            {
                result = result["return"];

                if (typeof(result) == "object")
                    return DebuggerLib.unwrapDebuggeeValue(result);
                else
                    return result;
            }
        }
        catch (e)
        {
            TraceError.sysout("debugger.evaluate; EXCEPTION " + e, e);
        }
    },

    evaluateInCallingFrame: function(js, fileName, lineNo)
    {
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

    getCurrentStackTrace: function(context)
    {
        return DebuggerHalter.getCurrentStackTrace(context);
    },

    hasValidStack: function(context)
    {
        return context.stopped;
    },

    getCurrentFrameKeys: function(context)
    {
        var frame = context.stoppedFrame;
        if (!frame || !frame.scopes)
        {
            //xxxHonza: Simon, I am seeing this a looot, is it a problem?
            TraceError.sysout("debugger.getCurrentFrameKeys; ERROR scopes: " +
                (frame ? frame.scopes : "no stopped frame"));
            return;
        }

        var ret = [];

        if (!frame.scopes)
        {
            TraceError.sysout("debugger.getCurrentFrameKyes; ERROR no scopes?");
            return ret;
        }

        for (var scope of frame.scopes)
        {
            // "this" is not a real scope.
            if (scope.name === "this")
                continue;

            // scope.getProperties() raises an exception when the frame execution is complete
            // (and the frame result value is displayed). So skip if the scope has no properties.
            if (!scope.hasProperties())
                continue;

            if (!scope.grip)
                continue;

            // We can't synchronously read properties of objects on the scope chain,
            // so always ignore them to avoid inconsistencies. They are pretty uncommon
            // anyway (apart from the global object, which gets special treatment).
            var type = scope.grip.type;
            if (type === "object" || type === "with")
                continue;

            var props = scope.getProperties();
            if (!props || !Array.isArray(props))
                continue;

            for (var prop of props)
                ret.push(prop.name);
        }

        return ret;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Private to Debugger

    beginInternalOperation: function() // stop debugger operations like breakOnErrors
    {
    },

    endInternalOperation: function(state)  // pass back the object given by beginInternalOperation
    {
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Menu in toolbar.

    onScriptFilterMenuTooltipShowing: function(tooltip, context)
    {
        Trace.sysout("onScriptFilterMenuTooltipShowing not implemented");
    },

    onScriptFilterMenuCommand: function(event, context)
    {
        var menu = event.target;
        Options.set("scriptsFilter", menu.value);

        Firebug.Debugger.filterMenuUpdate();
    },

    menuFullLabel:
    {
        "static": Locale.$STR("ScriptsFilterStatic"),
        "evals": Locale.$STR("ScriptsFilterEval"),
        "events": Locale.$STR("ScriptsFilterEvent"),
        "all": Locale.$STR("ScriptsFilterAll"),
    },

    menuShortLabel:
    {
        "static": Locale.$STR("ScriptsFilterStaticShort"),
        "evals": Locale.$STR("ScriptsFilterEvalShort"),
        "events": Locale.$STR("ScriptsFilterEventShort"),
        "all": Locale.$STR("ScriptsFilterAllShort"),
    },

    onScriptFilterMenuPopupShowing: function(menu, context)
    {
        if (this.menuTooltip)
            this.menuTooltip.fbEnabled = false;

        var items = menu.getElementsByTagName("menuitem");
        var value = this.filterButton.value;

        for (var i=0; i<items.length; i++)
        {
            var option = items[i].value;
            if (!option)
                continue;

            if (option == value)
                items[i].setAttribute("checked", "true");

            items[i].label = Firebug.Debugger.menuFullLabel[option];
        }

        return true;
    },

    onScriptFilterMenuPopupHiding: function(tooltip, context)
    {
        if (this.menuTooltip)
            this.menuTooltip.fbEnabled = true;

        return true;
    },

    filterMenuUpdate: function()
    {
        var value = Options.get("scriptsFilter");

        this.filterButton.value = value;
        this.filterButton.label = this.menuShortLabel[value];
        this.filterButton.removeAttribute("disabled");
        this.filterButton.setAttribute("value", value);

        Trace.sysout("debugger.filterMenuUpdate value: " + value + " label: " +
            this.filterButton.label);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // BTI

    toolName: "script",

    // xxxHonza: events are dispatched to connection (BTI.Browser) listeners
    // It's e.g. "getBreakpoints" at this moment.
    addListener: function(listener)
    {
        Firebug.connection.addListener(listener);
    },

    removeListener: function(listener)
    {
        Firebug.connection.removeListener(listener);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

    onSourceLoaded: function(sourceFile, lines)
    {
        Trace.sysout("debugger.SourceLoaded; " + sourceFile.href);

        // Delegate the event to the Script panel.
        var panel = sourceFile.context.getPanel("script");
        if (panel)
            panel.onSourceLoaded(sourceFile, lines);
    }
});

// ********************************************************************************************* //
// Registration

Firebug.registerActivableModule(Firebug.Debugger);

return Firebug.Debugger;

// ********************************************************************************************* //
});
