/*globals define, WebGMEGlobal*/

/**
 * Generated by VisualizerGenerator 1.7.0 from webgme on Wed Apr 14 2021 10:39:10 GMT-0500 (Central Daylight Time).
 */

define(['jointjs', 'css!./styles/SimSMWidget.css'], function (joint) {
    'use strict';

    var WIDGET_CLASS = 'sim-s-m';

    function SimSMWidget(logger, container) {
        this._logger = logger.fork('Widget');

        this._el = container;

        this.nodes = {};
        this._initialize();
        this.init_pn = null;
        this._logger.debug('ctor finished');
    }

    SimSMWidget.prototype._initialize = function () {
        console.log(joint);
        var width = this._el.width(),
            height = this._el.height(),
            self = this;

        // set widget class
        this._el.addClass(WIDGET_CLASS);

        this._jointSM = new joint.dia.Graph;
        this._jointPaper = new joint.dia.Paper({
            el: this._el,
            width : width,
            height: height,
            model: this._jointSM,
            interactive: false,
            cellViewNamespace: joint.shapes
        });

        ////////////////////////////////////////////
        //clickable states 
        // add event calls to elements
        this._jointPaper.on('element:pointerdblclick', function(elementView) {
            const activeElement = elementView.model;
            if (self._webgmeSM) {
                self._getActiveTransitions();
                var transitionId = self._webgmeSM.id2state[activeElement.id];
                if (self._webgmeSM.activeTransitions.includes(transitionId))
                self.fireEvent([transitionId]);
            }
        });

        this._webgmeSM = null;
    };

    SimSMWidget.prototype.onWidgetContainerResize = function (width, height) {
        this._logger.debug('Widget is resizing...');
    };

    SimSMWidget.prototype._getActiveTransitions = function () {
        const self = this;
        var transInplaces = {} // trans: [list of places]
        // places data : {dstTrans : [], position : null, markings : 0, name : null}
        //trans data : {data: {dstPlace : [], position : null}, name : null}
        for (const [transition, transData] of Object.entries(self._webgmeSM.transitions)) {
            transInplaces[transition] = []
            for (const [place, placeData] of Object.entries(self._webgmeSM.places)) {
                if (placeData["dstTrans"].includes(transition )) {
                    transInplaces[transition].push(place);
                }
            }
        }
        self._webgmeSM.transitionsInplaces = transInplaces;
        var activeTransitions = [];
        for (const [transition, places] of Object.entries(transInplaces)) {
            var isActive = true;
            for (let i = 0; i < places.length; i++) {
                if (self._webgmeSM.places[places[i]]["markings"] < 1) {
                    isActive = false;
                }
            }
            if (isActive) {
                activeTransitions.push(transition);
            }
        }
        
        self._webgmeSM.activeTransitions = activeTransitions
    }
    /////////////////////////////////////////////////////////////////////
    // State Machine manipulating functions called from the controller
    SimSMWidget.prototype.initMachine = function (machineDescriptor) {
        const self = this;
        // console.log(machineDescriptor);
        self.init_pn = machineDescriptor;
        self._webgmeSM = machineDescriptor;
        
        self._jointSM.clear();
        const pn = self._webgmeSM;
        pn.id2state = {}; // this dictionary will connect the on-screen id to the state id
        // add the places
        Object.keys(pn.places).forEach(placeId => {
            let vertex = null;
            
            vertex = new joint.shapes.standard.Circle({
                position: pn.places[placeId]["position"],
                size: { width: 70, height: 70 },
                attrs: {
                    label : {
                        y: 'calc(0.35*w)',
                        text: "\n\n\n\n" + pn.places[placeId]["name"],
                        fontWeight: 'bold',
                    },
                    body: {
                        strokeWidth: 2,
                        cursor: 'default'
                    }
                }
            });     
            vertex.addTo(self._jointSM);
            pn.places[placeId].joint = vertex;
            pn.id2state[vertex.id] = placeId;
        });

        //add transitions
        Object.keys(pn.transitions).forEach(transId => {
            let vertex = null;
            
            vertex = new joint.shapes.standard.Rectangle({
                position: pn.transitions[transId]["position"],
                size: { width: 38, height: 110},
                attrs: {
                    label : {
                        y: 'calc(.6*h)',
                        text: pn.transitions[transId]["name"],
                        fontWeight: 'bold',
                       
                    },
                    body: {
                        strokeWidth: 4,
                        cursor: 'default',
                        fill: "gray"

                    }
                }
            });     
            vertex.addTo(self._jointSM);
            pn.transitions[transId].joint = vertex;
            pn.id2state[vertex.id] = transId;

        });

        // then create the place to transition links
        Object.keys(pn.places).forEach(placeId => {
            const place = pn.places[placeId];
            for (let i = 0; i < place["dstTrans"].length; i++) {
                var transition = place["dstTrans"][i];
                const link = new joint.shapes.standard.Link({
                    source: {id: place.joint.id}, 
                    target: {id: pn.transitions[transition].joint.id}, 
                    attrs: {
                        line: {
                            strokeWidth: 2
                        },
                        wrapper: {
                            cursor: 'default'
                        }
                    }
                });
                link.addTo(self._jointSM);
            }

            self._getActiveTransitions();
        });

        // then create the transition to place links
        Object.keys(pn.transitions).forEach(transId => {
            const transition = pn.transitions[transId];

            for (let i = 0; i < transition["dstPlaces"].length; i++) {
                var place = transition["dstPlaces"][i];
                const link = new joint.shapes.standard.Link({
                    source: {id: transition.joint.id}, 
                    target: {id: pn.places[place].joint.id}, 
                    attrs: {
                        line: {
                            strokeWidth: 2
                        },
                        wrapper: {
                            cursor: 'default'
                        }
                    }
                });
                link.addTo(self._jointSM);
            }
        });

        //now refresh the visualization
        self._jointPaper.updateViews();
        self._decorateMachine();
        pn.markings = [];
    };
/////////////////////////////////////////////
    SimSMWidget.prototype.destroyMachine = function () {

    };
    /////////////////////////////////////////////////////
    SimSMWidget.prototype.fireEvent = function (activeTransitions) {
        // move markings to designated places 
        const pn = this._webgmeSM;

        for (let i = 0; i < activeTransitions.length; i++) {
            var transId = activeTransitions[i];
            var inplaces = pn.transitionsInplaces[transId]; //trans: [list of inplaces]
            for (let j = 0; j < inplaces.length; j++) {
                var place = inplaces[j];
                pn.places[place]["markings"]--; 

            }
            var idx = 0;
            var outplaces = pn.transitions[transId]["dstPlaces"];
            for (let markingNum = inplaces.length; markingNum > 0; markingNum--) {
                var place = outplaces[idx];
                pn.places[place]["markings"]++;
                if (idx < outplaces.length - 1) {
                    idx++;
                } else {
                    idx = 0;
                }
            }
            
        }
        this._setCurrentState();
    };
    SimSMWidget.prototype.resetMachine = function () {
        this.initMachine(this.init_pn);
     
    };
///////////////////////////////////
    SimSMWidget.prototype._decorateMachine = function() {
        
        const pn = this._webgmeSM;
        // update markingsinside 
        this._jointSM.removeCells(pn.markings);
        pn.markings = [];
        for (const [placeId, placeData] of Object.entries(pn.places)) {
            var markings = placeData["markings"];
            if (markings > 12) {
                ///label in center
                placeData.joint.attr('label/text', markings + "\n\n\n" + pn.places[placeId]["name"]);
            } else {
                placeData.joint.attr('label/text',"\n\n\n" + pn.places[placeId]["name"]);
                var position = pn.places[placeId]["position"]
                var rem = markings % 3;
                var offsetX = position.x + (rem > 0 && markings < 4 ? (3 - rem) * 10 : 0);
                var offsetY = position.y + (4 - Math.ceil(markings / 3)) * 10; 
                for (let i = 0; i < markings; i++) {
                    var marking = new joint.shapes.standard.Circle({
                        position: {x: offsetX + 15, y: offsetY - 2},
                        size: { width: 10, height: 10 },
                        attrs: {
                            body: {
                                strokeWidth: 2,
                                fill: "black",
                                cursor: 'default'
                            }
                        }
                    });     
                    this._jointSM.addCell(marking);
                    pn.markings.push(marking)
                    offsetX += 15;

                    if (i % 3 == 0) {
                    offsetY += 15;
                    offsetX = position.x + (rem > 0 && markings - i < 4 ? (3 - rem) * 10 : 0);
                    }
                
            }
        }

    }
        if (pn.activeTransitions.length > 0) {
            Object.keys(pn.transitions).forEach(trans => {
                var transJoint = pn.transitions[trans].joint;
                if (pn.activeTransitions.includes(trans)) { //highlight active transitions
                    transJoint.attr('body/stroke', 'green');
                    transJoint.attr('body/cursor' , 'pointer');

                } else {
                    transJoint.attr('body/stroke', '#333333');
                    transJoint.attr('body/cursor' , 'default');
                }
            });
        } else {
            //deadlocked!!!
            setTimeout(function() { alert('There are no more active transition!');}, 300);
            Object.keys(pn.transitions).forEach(trans => {
                var transJoint = pn.transitions[trans].joint;
                transJoint.attr('body/stroke', 'red');
            });

        }
        pn.setFireableEvents(pn.activeTransitions);
        
    };
    ///////////////////
    SimSMWidget.prototype._setCurrentState = function() {
        //get active transitions
        this._getActiveTransitions();
        this._decorateMachine();
    };
    

    /* * * * * * * * Visualizer event handlers * * * * * * * */

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    SimSMWidget.prototype.destroy = function () {
    };

    SimSMWidget.prototype.onActivate = function () {
        this._logger.debug('SimSMWidget has been activated');
    };

    SimSMWidget.prototype.onDeactivate = function () {
        this._logger.debug('SimSMWidget has been deactivated');
    };

    return SimSMWidget;
});