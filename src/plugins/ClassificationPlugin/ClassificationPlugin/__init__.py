"""
This is where the implementation of the plugin code goes.
The ClassificationPlugin-class is imported from both run_plugin.py and run_debug.py
"""
import sys
import logging
from webgme_bindings import PluginBase

# Setup a logger
logger = logging.getLogger('ClassificationPlugin')
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)  # By default it logs to stderr..
handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

class ClassificationPlugin(PluginBase):
    def main(self):
        self.namespace = None
        core = self.core
        active_node = self.active_node
        nodes = core.load_children(active_node)
        meta = self.META

        # name = core.get_attribute(active_node, 'name')
        # core.set_attribute(active_node, 'name', 'newName')
        # commit_info = self.util.save(root_node, self.commit_hash, 'master', 'Python plugin updated the model')
        # if core.is_instance_of(node, meta["Place"]) or core.is_instance_of(node, Meta["Switch"]):
        #  elif core.is_instance_of(node, meta["Transition"])  
        
        classifications = {"Free Choice":True, "Marked Graph":False, "Workflow":False, "State Machine":False}
     
        placeToTransition = {} #placeNode as src:[list of transition destinations]
        transitionToPlace = {} #transitionNode as src:[list fo place destinations]
       
        
        nodesByPath = {}
        for node in nodes:
            path = core.get_path(node)
            nodesByPath[path] = node
            if core.is_instance_of(node, meta["Place"]):
                placeToTransition[path] = []
            if core.is_instance_of(node, meta["Transition"]):
                transitionToPlace[path] = []
        for node in nodes: 
            path = core.get_path(node) #to avoid those with same names 
            isPlaceToTransition = core.is_instance_of(node, meta["Arc_PlaceToTransition"])
            if  isPlaceToTransition or core.is_instance_of(node, meta["Arc_TransitionToPlace"]):
                src = core.get_pointer_path(node, "src")
                dst = core.get_pointer_path(node, "dst")
                if src != dst: 
                    if isPlaceToTransition:
                        placeToTransition[src].append(dst)
                    else:
                        transitionToPlace[src].append(dst)
 
        placeInplaceCount = {}
        sourceCount = 0
        source = None
        for place in placeToTransition.keys():
            numOfDest = len(placeToTransition[place])
            if  numOfDest > 1: # is not Free Choice PetriNet  
                classifications["Free Choice"] = False
            elif numOfDest == 1:
                isSource = True
                for trans in transitionToPlace.keys():
                    if (place in transitionToPlace[trans]):
                        isSource = False
                if (isSource):
                    sourceCount += 1
                    source = place
                
            # if classifications["Free Choice"]:
            placeInplaceCount[place] = 0
            for inplaces in transitionToPlace.values(): #count times it is the destination list - inplaces count
                placeInplaceCount[place] += inplaces.count(place)
            

        isStateMachine = True
        transInplaceCount = {}
        sinkCount = 0
        sink = None
        for trans in transitionToPlace.keys():
            numOfDest = len(transitionToPlace[trans])
            if numOfDest != 1:
                isStateMachine = False
            elif numOfDest == 1:
                place = transitionToPlace[trans][0]
                if len(placeToTransition[place]) == 0:
                    sinkCount += 1
                    sink = place

            # if isStateMachine: # no need to waste time if is not qualified as State machine
            transInplaceCount[trans] = 0
            for inplaces in placeToTransition.values():
                transInplaceCount[trans] += inplaces.count(trans)


        # is Marked graph if is Free Choice and place is the sole one in dst list
        placeCountList = placeInplaceCount.values() 
        if classifications["Free Choice"]:
            if all(x == 1 for x in placeCountList):
                classifications["Marked Graph"] = True 
        # is StateMachine if all dst of length 1 and transition is the sole one in src list
        transCountList = transInplaceCount.values() 
        if isStateMachine:
            if all(x == 1 for x in transCountList):
                classifications["State Machine"] = True

        if sourceCount == 1 and sinkCount == 1: # is Workflow if 1 source and 1 sink and all others are connected
            #mark source as visited
            visited = [source]
            queue = [source]
             #graph traversal bfs
            while len(queue) > 0:
                curPlace = queue.pop(0)
                for transition in placeToTransition[curPlace]:
                    for place in transitionToPlace[transition]:
                        if place not in visited:
                            visited.append(place)
                            queue.append(place)
            
            totalPlaces = len(placeToTransition.keys())

            if visited[-1] == sink and len(visited) == totalPlaces:
                classifications["Workflow"] = True


        notification = "Petri Net classifications:"
        
        for classification in classifications.keys():
            if (classifications[classification]):
                notification += " *{0}".format(classification)

        self.send_notification(notification if len(notification) > 26 else "You're Petri Net has no classification.")