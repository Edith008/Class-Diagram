import React, { useState, useEffect, useRef } from 'react';
import { ReactDiagram } from 'gojs-react';
import * as go from 'gojs';
import { Button } from "@/components/ui/button";
import { Invitacion } from '../invitacion.jsx';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/authContext';
import { doc, onSnapshot, setDoc, collection, addDoc, updateDoc, getDoc, getDocs,query,where } from "firebase/firestore";
import { db } from '../../firebase.jsx';


//let myDiagram;
const generateKey = () => (Math.random() * 1e17).toString(36);

const ClassDiagram = () => {
    const diagramRef = useRef(null);
    const [myDiagram, setMyDiagram] = useState(null);
    const [modelJson, setModelJson] = useState(JSON.stringify({ class: "go.GraphLinksModel", nodeDataArray: [], linkDataArray: [] }, null, 2));
    const [isAddClassModalVisible, setIsAddClassModalVisible] = useState(false);
    const [newClass, setNewClass] = useState({ key: '', text: '', properties: [], methods: [] });
    const { isInviteModalOpen, setInviteModalOpen, emailData, setEmailData, handleInputChange, handleSendEmail } = Invitacion();
    const { diagramaId,documentId } = useParams();
    //console.log('documentId :', documentId);
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const diagramaNombre = params.get('nombre');
    const { logout } = useAuth();


    const [diagram, setDiagram] = useState(null); // El diagrama de GoJS
    const [propertyDefault, setPropertyDefault] = useState('');

    const [propertyName, setPropertyName] = useState('');
    const [propertyType, setPropertyType] = useState('');
    const [propertyVisibility, setPropertyVisibility] = useState('public'); // Puede ser public, private, protected

    const [selectedNode, setSelectedNode] = useState(null); // Nodo seleccionado
    const [attributeName, setAttributeName] = useState(''); // Nombre del atributo
    const [attributeType, setAttributeType] = useState('int'); // Tipo del atributo
    const [isModalOpen, setIsModalOpen] = useState(false); // Control del modal

    // Initialize GoJS Diagram
    useEffect(() => {

        if (!diagramRef.current) return;


        const initDiagram = () => {
            const $ = go.GraphObject.make;
            const diagram = $(go.Diagram, {
              'undoManager.isEnabled': true, // Habilita deshacer/rehacer
           //   'model': new go.GraphLinksModel([], []),
              'clickCreatingTool.archetypeNodeData': { text: 'Node', color: 'white' },
              'draggingTool.dragsLink': true,
              'dragSelectingTool.isEnabled': true,
              "linkingTool.isEnabled": true,
              "relinkingTool.isEnabled": true,
              "draggingTool.isEnabled": true,
              "isReadOnly": false,
              "initialContentAlignment": go.Spot.Center
        
            });

            // Aquí defines la plantilla de nodos, donde añadimos el binding para la locación
            diagram.nodeTemplate =
            $(go.Node, "Auto",
                // Binding de la propiedad 'location' con la propiedad 'loc' del modelo JSON
                new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
                $(go.Shape, "RoundedRectangle", { strokeWidth: 0, fill: "lightgray" }),
                $(go.TextBlock, { margin: 8, editable: true },
                    new go.Binding("text", "name").makeTwoWay()) // Bind para el nombre del nodo
            );

            // Configura el modelo del diagrama
            diagram.model = new go.GraphLinksModel([],[] );
            console.log('Diagrama inicializado:', diagram);
        
            return diagram;
        };
     

        console.log('diagramRef.current:', diagramRef.current);
        console.log('myDiagram:', myDiagram);
        if (!diagramRef.current) return; 
      
        // Inicializa el diagrama solo si no está ya creado
        if (!myDiagram) {
          const diagram = initDiagram();  // Usa tu método para inicializar el diagrama
          setMyDiagram(diagram);  // Almacena el diagrama en el estado
          diagram.div = diagramRef.current; // Conecta el diagrama a su contenedor en el DOM
        }

        // Asegúrate de que 'myDiagram' esté inicializado antes de usarlo
        if (myDiagram) {
          console.log('Inicializando nodos...');
          getDocumentIdByDiagramaId(diagramaId)  
          crearNodo(myDiagram);   
          ListenersModificar(myDiagram);  
          ListenersMovimiento(myDiagram, setModelJson); //bien 
          setModelJson(myDiagram.model.toJson());
          ListenersEnlaces(myDiagram);
      

          loadNodes(diagramaId, myDiagram);
          addNodeToFirestore();
          //updateFirestoreNode(nodeId, newData)


          if (documentId) {
            updateModelData(documentId);  
            //descargarArchivoSDS() 
          }
          loadDiagram(diagramaId); // Cargar el diagrama desde la base de datos



          // Guardar el diagrama en Firestore cuando se cambien los datos
          const handleSave = () => {
            saveDiagram(diagramaId, myDiagram.model.toJson());
          };
        }
      
        return () => {
          if (myDiagram) {
            myDiagram.div = null;   // Desconecta el diagrama de su contenedor en el DOM
          }
        };
    }, [diagramRef, myDiagram, diagramaId,documentId]); 

    //--------------------------------------------------------------------------------------------------------------
    //--------------------------------------------------------------------------------------------------------------

    function convertVisibility(v) {
        switch (v) {
          case 'public': return '+';
          case 'private': return '-';
          case 'protected': return '#';
          case 'package': return '~';
          default: return v;
        }
    }

    // Define the property template
    var propertyTemplate = new go.Panel('Horizontal')
        .add(
          // property visibility/access
          new go.TextBlock({ isMultiline: false, editable: false, width: 12 })
            .bind('text', 'visibility', convertVisibility),
          // property name, underlined if scope=="class" to indicate static property
          new go.TextBlock({ isMultiline: false, editable: true })
            .bindTwoWay('text', 'name'),
            //.bind('isUnderline', 'scope', s => s[0] === 'c'),
          // property type, if known
          new go.TextBlock('')
            .bind('text', 'type', t => t ? ': ' : ''),
          new go.TextBlock({ isMultiline: false, editable: true })
            .bindTwoWay('text', 'type'),
          // property default value, if any
          new go.TextBlock({ isMultiline: false, editable: false })
            .bind('text', 'default', s => s ? ' = ' + s : '')
        );

    // Define the method template
    var methodTemplate = new go.Panel('Horizontal')
        .add(
          // method visibility/access
          new go.TextBlock({ isMultiline: false, editable: false, width: 12 })
            .bind('text', 'visibility', convertVisibility),
          // method name, underlined if scope=="class" to indicate static method
          new go.TextBlock({ isMultiline: false, editable: true })
            .bindTwoWay('text', 'name')
            .bind('isUnderline', 'scope', s => s[0] === 'c'),
          // method parameters
          new go.TextBlock('()')
            // this does not permit adding/editing/removing of parameters via inplace edits
            .bind('text', 'parameters', parr => {
              var s = '(';
              for (var i = 0; i < parr.length; i++) {
                var param = parr[i];
                if (i > 0) s += ', ';
                s += param.name + ': ' + param.type;
              }
              return s + ')';
            }),
          // method return type, if any
          new go.TextBlock('')
            .bind('text', 'type', t => t ? ': ' : ''),
          new go.TextBlock({ isMultiline: false, editable: true })
            .bindTwoWay('text', 'type')
        );

    // Define the node template clase   
    const crearNodo = (myDiagram) => {
        myDiagram.nodeTemplate =
            new go.Node('Auto', {
            locationSpot: go.Spot.Center,
            fromSpot: go.Spot.AllSides,
            toSpot: go.Spot.AllSides,
            selectionAdorned: true,
            })
          .add(
            new go.Shape({ fill: 'lightyellow' }),
            new go.Panel('Table', { defaultRowSeparatorStroke: 'black' })
              .add(
                // header
                new go.TextBlock('   clase   ',{
                  row: 0, columnSpan: 2, margin: 3, alignment: go.Spot.Center,
                  font: 'bold 12pt sans-serif',
                  isMultiline: false, editable: true
                })
                  .bindTwoWay('text', 'name'),
                // properties
                new go.TextBlock('Propiedades', { row: 1, font: 'italic 10pt sans-serif' })
                  .bindObject('visible', 'visible', v => !v, undefined, 'PROPERTIES'),
                    
                new go.Panel('Vertical', {
                  name: 'PROPERTIES',
                  row: 1,
                  margin: 3,
                  stretch: go.Stretch.Horizontal,
                  defaultAlignment: go.Spot.Left,
                  background: 'lightyellow',
                  itemTemplate: propertyTemplate, 
                })
                  .bind('itemArray', 'properties'),
                
                go.GraphObject.build("PanelExpanderButton", {
                  row: 1,
                  column: 1,
                  alignment: go.Spot.TopRight,
                  visible: false,
                 // click: (e, button) => handleAddProperty(e, button) 
                }, "PROPERTIES")
                .bind('visible', 'properties', arr => arr.length > 0),
                
                // methods
                new go.TextBlock('Metodos', { row: 2, font: 'italic 10pt sans-serif' })
                  .bindObject('visible', 'visible', v => !v, undefined, 'METHODS'),
                new go.Panel('Vertical', {
                  name: 'METHODS',
                  row: 2,
                  margin: 3,
                  stretch: go.Stretch.Horizontal,
                  defaultAlignment: go.Spot.Left,
                  background: 'lightyellow',
                  itemTemplate: methodTemplate
                })
                  .bind('itemArray', 'methods'),
                go.GraphObject.build("PanelExpanderButton", {
                  row: 2,
                  column: 1,
                  alignment: go.Spot.TopRight,
                  visible: false
                }, "METHODS")
                  .bind('visible', 'methods', arr => arr.length > 0)
              )
          );
    } 

    ///////////////////////////////////////////////////////////////////////////////////

    const handleAddProperty = (e, button) => {
            // Comprobamos si 'button' y 'button.part.adornedPart' están definidos
            if (!button || !button.part || !button.part.adornedPart) {
              console.error("No se pudo encontrar el nodo adornedPart.");
              return;
            }
          
            const node = button.part.adornedPart;  // El nodo asociado
            const diagram = node.diagram;
          
            if (!diagram) {
              console.error("El diagrama no está disponible.");
              return;
            }
          
            diagram.startTransaction('add property');
          
            const newProperty = {
              name: 'newProperty',  // Nombre por defecto
              type: 'String',       // Tipo por defecto
              visibility: 'public'  // Visibilidad por defecto
            };
          
            // Añadir la nueva propiedad a la lista de propiedades del nodo
            const nodeData = node.data;
            if (!nodeData.properties) {
              nodeData.properties = [];
            }
            nodeData.properties.push(newProperty);
          
            // Actualizar el modelo
            diagram.model.updateTargetBindings(nodeData);
            diagram.commitTransaction('add property');
    }; 


    const handleSubmitProperty = () => {
        const selectedNodeData = selectedNode.data;
        
        const newProperty = {
            name: propertyName,
            type: propertyType,
            visibility: propertyVisibility
        };
        
        myDiagram.startTransaction('add property');
        selectedNodeData.properties.push(newProperty);
        myDiagram.model.updateTargetBindings(selectedNodeData);
        myDiagram.commitTransaction('add property');
        
        // Limpiar los campos del modal
        setPropertyName('');
        setPropertyType('');
        setPropertyVisibility('public');
    };
            
    
    //////////////////////////////////////////////////////////////////////////////////       

    const handleAddClass = () => {
        if (!myDiagram || !(myDiagram instanceof go.Diagram)) {
            console.error("myDiagram is not initialized or is not an instance of go.Diagram");
            return;
        }

        const newNodeData = {
            key: generateKey(),  
            loc: '0 0',
            properties: ["attribute1", "attribute2"],
            methods: ["method1(): returnType"]
        };

        console.log("New node created:", newNodeData); // Verifica el nodo creado

        if (!newNodeData.key) {
            console.error("Node key is missing or invalid:", newNodeData);
            return;
        }

        myDiagram.startTransaction("add new class");
        myDiagram.model.addNodeData(newNodeData);
        myDiagram.commitTransaction("add new class");

        addNodeToFirestore(newNodeData, diagramaId)
            .then(() => {
                console.log("New class node created and added to Firestore");
            })
            .catch((error) => {
                console.error("Error adding new class to Firestore:", error);
            });

        const updatedModelJson = JSON.stringify(myDiagram.model.toJson(), null, 2);
        setModelJson(updatedModelJson);
    } ;
    
    const addNodeToFirestore = async (node, diagramaId) => {
        /*try {
            console.log('Nodo recibido:', node);  
            console.log('diagramaId recibido:', diagramaId);  
    
            if (!node || !node.key) {
                console.error('Node is undefined or missing key:', node);
                return;
            }
    
            const nodeWithDiagramaId = {
                ...node,
                diagramaId: diagramaId
            };
    
            const docRef = doc(db, 'nodos', node.key);
            await setDoc(docRef, nodeWithDiagramaId);
    
            console.log('Documento añadido con ID:', node.key, 'y diagramaId:', diagramaId);
        } catch (error) {
            console.error('Error añadiendo documento:', error);
        }*/
    };
    
    const loadNodes = async (diagramaId) => {
       /* try {
            // Asegúrate de que el diagramaId esté definido
            if (!diagramaId) {
                console.error("DiagramaId no está definido.");
                return;
            }
    
            const nodesCollection = collection(db, 'nodos');
            const nodesQuery = query(nodesCollection, where('diagramaId', '==', diagramaId));
    
            const nodesSnapshot = await getDocs(nodesQuery);
            const nodes = nodesSnapshot.docs.map(doc => ({ ...doc.data(), key: doc.id }));
    
            // Actualiza el modelo del diagrama con los nodos filtrados
            myDiagram.model.nodeDataArray = nodes;
            console.log("Nodos del diagrama cargados correctamente:", nodes);
        } catch (error) {
            console.error("Error loading nodes:", error);
        }
        //quiero las posiciones de los nodos
        console.log("Nodos del diagrama cargados correctamente:", myDiagram.model.nodeDataArray);
      */
    };



    // Añadir un listener para el evento 'Modified' del diagrama
    const ListenersModificar = (myDiagram) => {
        myDiagram.addDiagramListener('Modified', (e) => {
            const button = document.getElementById('SaveButton');
            if (button) button.disabled = !myDiagram.isModified;
            const idx = document.title.indexOf('*');
            if (myDiagram.isModified) {
                if (idx < 0) document.title += '*';
            } else {
                if (idx >= 0) document.title = document.title.slice(0, idx);
            }
        });   
    }    

        
    const ListenersEnlaces = (myDiagram) => {
        myDiagram.addDiagramListener('LinkDrawn', async (e) => {
            const link = e.subject;
            const fromNode = link.fromNode.data.key;
            const toNode = link.toNode.data.key;
            console.log(link.data);
            const startLabel = link.data.startLabel || 'start1';
            const endLabel = link.data.endLabel || 'end1';
            const centerLabel = link.data.centerLabel || 'center1';
    
            const newLinkData = { from: fromNode, to: toNode, startLabel, endLabel, centerLabel };
            try {
                const linkRef = doc(collection(db, 'links'));
                await setDoc(linkRef, newLinkData);
                console.log("Nuevo enlace creado:", JSON.stringify(newLinkData, null, 2));
            } catch (error) {
                console.error("Error creating link:", error);
            }
        });
    }    

    // Listener para la edición de texto
    const ListenersTexto = (myDiagram) => {
        myDiagram.addDiagramListener('TextEdited', async (e) => {
            const editedTextBlock = e.subject;
            const part = editedTextBlock.part;
        
            if (part instanceof go.Node) {
                const nodeData = part.data;
                const nodeRef = doc(db, 'nodos', nodeData.key);
        
                try {
                    await updateDoc(nodeRef, { text: nodeData.text });
                    console.log("Nodo actualizado:", JSON.stringify(nodeData, null, 2));
                } catch (error) {
                    console.error("Error updating node:", error);
                }
            } else if (part instanceof go.Link) {
                const linkData = part.data;
                const startLabel = linkData.startLabel || 'start1';
                const endLabel = linkData.endLabel || 'end1';
                const centerLabel = linkData.centerLabel || 'center1';
        
                const linkQuery = collection(db, 'links');
                const querySnapshot = await getDocs(linkQuery);
                querySnapshot.forEach(async (doc) => {
                    try {
                        await updateDoc(doc.ref, { startLabel, endLabel, centerLabel });
                        console.log("Enlace actualizado:", JSON.stringify(linkData, null, 2));
                    } catch (error) {
                        console.error("Error updating link:", error);
                    }
                });
            }
        });
    }


    // Función para actualizar el nodo en Firestore
    async function updateFirestoreNode(nodeId, newData) {
       /* if (!nodeId || typeof newData !== 'object' || newData === null) {
            console.error('Datos de actualización no válidos:', newData);
            return;
        }

        const nodeRef = doc(db, 'nodos', nodeId); // Referencia al documento en Firestore

        try {
            const docSnap = await getDoc(nodeRef);

            if (!docSnap.exists()) {
                console.error('El documento no existe en Firestore:', nodeId);
                return;
            }

            await updateDoc(nodeRef, newData);
            console.log('Nodo actualizado con éxito');
        } catch (error) {
            console.error('Error actualizando el nodo:', error);
        }*/
    }


    // Listener para mover nodos y actualizar Firestore
    const ListenersMovimiento = (myDiagram) => {
        myDiagram.addDiagramListener("SelectionMoved", (e) => {
            console.log("SelectionMoved event fired");
            
            const movedParts = e.subject;
        
            // Asegúrate de que movedParts sea un Set
            if (movedParts instanceof go.Set) {
                movedParts.each(part => {
                    if (part instanceof go.Part) {
                        console.log("Moved part:", part);
                        console.log("Node data:", part.data);
                        
                        // Obtener la ubicación actual del nodo
                        let newLoc = part.position;
        
                        // Ajustar la ubicación: -4px en x y +2px en y
                        //newLoc = new go.Point(newLoc.x + 83, newLoc.y + 40);
                        newLoc = new go.Point(newLoc.x, newLoc.y)
        
                        // Crear el nuevo objeto de datos con la ubicación ajustada
                        const nodeDataWithNewLoc = {
                            ...part.data,
                            loc: go.Point.stringify(newLoc)  // Convertir la ubicación a cadena
                        };
        
                        console.log("Nodo movido:", JSON.stringify(nodeDataWithNewLoc, null, 2));
        
                        // Asegurarse de que DocumentId está disponible
                        if (DocumentId) {
                            // Actualiza el nodo en Firestore
                            updateModelData(DocumentId, nodeDataWithNewLoc);
                        } else {
                            console.error("DocumentId no está definido. Verifica que has llamado a getDocumentIdByDiagramaId.");
                        }
                    } else {
                        console.error("Item in movedParts is not an instance of go.Part.");
                    }
                });
            } else {
                console.error("e.subject is neither a go.Set nor a go.Part.");
            }
        });
    };

    let DocumentId = "";  // Variable global para almacenar el documentId de Firestore
    // Obtener el documentId de Firestore basado en diagramaId
    async function getDocumentIdByDiagramaId(diagramaId) {
        try {
            const diagramaCollection = collection(db, 'diagramas');
            const q = query(diagramaCollection, where('diagramaId', '==', diagramaId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error('No se encontró ningún documento con el diagramaId proporcionado');
            }

            const docSnapshot = querySnapshot.docs[0];
            DocumentId = docSnapshot.id;  
            console.log('Document ID:', DocumentId);

            return DocumentId;  // Devolver el documentId por si se necesita
        } catch (error) {
            console.error('Error al obtener el documentId:', error);
            throw error;
        }
    }

    // Actualizar el modelData de Firestore
    const updateModelData = async (documentId, nodeDataWithNewLoc) => {
        try {
            if (!db) throw new Error("Firestore DB no está inicializado.");
            if (!documentId) throw new Error("documentId es indefinido o nulo.");

            const docRef = doc(db, "diagramas", documentId);

            // Obtener el modelData actual desde Firestore
            const docSnapshot = await getDoc(docRef);
            if (!docSnapshot.exists()) {
                throw new Error("El documento no existe en Firestore.");
            }

            const currentData = docSnapshot.data();
            let currentModelData = JSON.parse(currentData.modelData || '{}');

            // Verificar que nodeDataArray exista en el modelo actual
            const currentNodeDataArray = currentModelData.nodeDataArray || [];

            // Mostrar el estado actual del nodeDataArray para depuración
            console.log("currentNodeDataArray desde Firestore:", currentNodeDataArray);

            // Actualizar solo el nodo modificado en el array de nodos
            const updatedNodeDataArray = currentNodeDataArray.map(node =>
                node.key === nodeDataWithNewLoc.key ? nodeDataWithNewLoc : node
            );

            // Verificar si el nodo no está en el array (nuevo nodo)
            if (!currentNodeDataArray.some(node => node.key === nodeDataWithNewLoc.key)) {
                updatedNodeDataArray.push(nodeDataWithNewLoc);  // Si no existe, lo añadimos
            }

            // Crear el nuevo modelData con los datos actualizados
            const updatedModelData = {
                "class": "_GraphLinksModel",
                "nodeDataArray": updatedNodeDataArray,
                "linkDataArray": currentModelData.linkDataArray || []
            };

            // Mostrar el estado del nodo que intentamos actualizar
            console.log("Nodo a actualizar:", JSON.stringify(nodeDataWithNewLoc, null, 2));
            console.log("ModelData actualizado:", JSON.stringify(updatedModelData, null, 2));

            // Actualizar Firestore con el nuevo modelData
            await updateDoc(docRef, {
                modelData: JSON.stringify(updatedModelData),
                updatedAt: new Date()  // Actualiza el timestamp de la última modificación
            });

            console.log("Model data actualizado en Firebase correctamente");
        } catch (error) {
            console.error("Error actualizando modelData:", error.message || error);
        }
    };


  
  
    async function save(diagramaId) {
        if (myDiagram.model && typeof myDiagram.model.toJson === 'function') {
            const modelData = myDiagram.model.toJson();
            const diagramRef = doc(db, 'diagramas', diagramaId);
            try {
                await setDoc(diagramRef, { modelData });
                console.log('Datos del diagrama guardados en Firestore');
            } catch (error) {
                console.error('Error al guardar datos del diagrama:', error);
            }
            myDiagram.isModified = false;
        } else {
            console.error('model.toJson is not a function');
        }
    }

    //kdshfkjdskfjdsf
    const saveDiagram = async (diagramaId, modelJson) => {
        try {
            const docRef = doc(db, 'diagramas', diagramaId);
            await updateDoc(docRef, {
                modelData: modelJson
            });
            console.log('Diagrama guardado con éxito');
        } catch (error) {
            console.error('Error al guardar el diagrama:', error);
        }
    };

    function loadDiagram(diagramaId) {
        const diagramRef = doc(db, 'diagramas', diagramaId);
        return onSnapshot(diagramRef, (doc) => {
            if (doc.exists()) {
                const diagramData = doc.data();
                try {
                    const model = go.GraphLinksModel.fromJson(diagramData.modelData);
                    if (!model.linkKeyProperty) {
                        model.linkKeyProperty = 'key';
                    }
                    myDiagram.model = model;
                } catch (error) {
                    console.error('Error al cargar datos del diagrama:', error);
                }
            } else {
                myDiagram.model = new go.GraphLinksModel();
            }
        });
    }
    

    function handleDrop(e) {
        e.preventDefault();
        const point = myDiagram.transformViewToDoc(new go.Point(e.clientX, e.clientY));
        const newNodeData = {
            key: Math.random().toString(),
            text: e.dataTransfer.getData("text"),
            loc: go.Point.stringify(point),
            attributes: [],
            methods: ["newMethod(): returnType"]
        };
        myDiagram.model.addNodeData(newNodeData);

        addDoc(collection(db, 'nodos'), newNodeData)
            .then((docRef) => console.log("Nuevo nodo creado con ID:", docRef.id))
            .catch((error) => console.error("Error creating node:", error));
    }

    /*function descargarArchivoSDS() {
        if (typeof myDiagram.model.toJson === 'function') {
            const text = myDiagram.model.toJson();
            const blob = new Blob([text], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'diagrama.sds';
            link.click();
        } else {
            console.error('model.toJson is not a function');
        }
    }*/

    function descargarArchivoSDS() {
        if (myDiagram && myDiagram.nodes) {
            const nodeDataArray = [];
    
            // Iterar sobre todos los nodos del diagrama
            myDiagram.nodes.each(node => {
                if (node instanceof go.Node) {
                    const key = node.data.key || "";
                    const name = node.data.name || "sin_nombre";
                    const properties = node.data.properties || [];
                    const methods = node.data.methods || [];
                    
                    // Obtener la ubicación actual desde la propiedad position del nodo
                    const loc = go.Point.stringify(node.position) || "0 0";
    
                    // Crear el objeto del nodo con la loc actualizada
                    nodeDataArray.push({
                        key: key,
                        loc: loc,              // La ubicación actual del nodo
                        properties: properties,
                        methods: methods,
                        name: name
                    });
                }
            });
    
            // Estructurar los datos finales en el formato requerido
            const data = {
                "class": "_GraphLinksModel",
                "linkKeyProperty": "key",  // Clave de los enlaces
                "nodeDataArray": nodeDataArray,  // Nodos con sus atributos actualizados
                "linkDataArray": myDiagram.model.linkDataArray || []  // Enlaces entre nodos
            };
    
            // Convertir los datos a formato JSON
            const text = JSON.stringify(data, null, 2); // Formato legible (indentado)
    
            // Crear el archivo y descargarlo
            const blob = new Blob([text], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
    
            // Crear un enlace temporal para la descarga
            const link = document.createElement('a');
            link.href = url;
            link.download = 'diagrama.sds'; // Nombre del archivo
            link.click();
        } else {
            console.error('El modelo o nodeDataArray no está disponible.');
        }
    } 

    /* falta obtener el documentId            
    async function descargarArchivoSDS() {
        console.log("DocumentId:", DocumentId);
        if (!DocumentId) {
            console.error("DocumentId no está definido.");
            return;
        }
    
        try {
            const docRef = doc(db, "diagramas", DocumentId);
            const docSnapshot = await getDoc(docRef);
            if (!docSnapshot.exists()) {
                throw new Error("El documento no existe en Firestore.");
            }
    
            const currentData = docSnapshot.data();
            let modelData = JSON.parse(currentData.modelData || '{}');
    
            const nodeDataArray = modelData.nodeDataArray.map(node => ({
                key: node.key || "",
                loc: node.loc || "0 0",
                properties: node.properties || [],
                methods: node.methods || [],
                name: node.name || "sin_nombre"
            }));
    
            const data = {
                "class": "_GraphLinksModel",
                "linkKeyProperty": "key",
                "nodeDataArray": nodeDataArray,
                "linkDataArray": modelData.linkDataArray || []
            };
    
            const text = JSON.stringify(data, null, 2);
            const blob = new Blob([text], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
    
            const link = document.createElement('a');
            link.href = url;
            link.download = 'diagrama.sds';
            link.click();
        } catch (error) {
            console.error("Error al descargar el archivo:", error);
        }
    }*/
                
        
        
    function nuevoDiagrama() {
        myDiagram.model = new go.GraphLinksModel();
    }

    function importarArchivo2() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sds';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                myDiagram.model = go.Model.fromJson(text);
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function importarArchivo() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.SDS'; // Aceptar archivos .json
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const jsonData = JSON.parse(text); // Convertir a objeto JSON
    
                // Cargar el modelo en el diagrama respetando las posiciones (loc) definidas en el archivo
                myDiagram.model = go.Model.fromJson(jsonData);
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    

    function descargarSVG() {
        const svg = myDiagram.makeSvg({ scale: 1, background: 'white', documentTitle: 'Diagrama de secuencia' });
        const svgstr = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgstr], { type: 'image/svg+xml' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'diagrama.svg';
        link.click();
    }

    function descargarPNG() {
        const img = myDiagram.makeImage({ scale: 2, background: 'white', type: 'image/png' });
        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'diagrama.png';
        link.click();
    }


    function handleAddLink() {
        const newLinkData = {
            key: generateKey(),
            from: 'Node1',
            to: 'Node2',
            startLabel: 'start1',
            endLabel: 'end1',
            centerLabel: 'center1'
        };

        myDiagram.model.addLinkData(newLinkData);

        addDoc(collection(db, 'links'), newLinkData)
            .then((docRef) => console.log("New link created with ID:", docRef.id))
            .catch((error) => console.error("Error adding new link:", error));
    }

    if (!modelJson) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <nav className="navbar_container_diagrama">
                <div className="texto_blanco">
                    <p><strong>DIAGRAMA:</strong> {diagramaNombre}</p>
                </div>
                <div className="boton_LimpiarDiagrama">
                    <Button type="button" className="btn-cel btn-info navbar-btn" onClick={nuevoDiagrama}>Limpiar Diagrama</Button>
                </div>
                <div className="botones_navbar">
                    <Button className="botones_navbar_button" onClick={importarArchivo}>Importar</Button>
                    <Button id="SaveButton" className="botones_navbar_button" onClick={() => save(diagramaId)}>Guardar</Button>
                    <Button className="botones_navbar_button" onClick={descargarArchivoSDS}>Descargar</Button>
                    <Button className="botones_navbar_button" onClick={logout}>Logout</Button>
                </div>
            </nav>

            <div>
                <div className="sidebar_diagram">
                    <div>
                        <p>Id: {diagramaId}</p><br />
                    </div>


 


                    <button type="submit" onClick={() => setInviteModalOpen(true)}><strong>INVITAR COLABORADOR</strong></button><br />
                    {isInviteModalOpen && (
                        <div className="modal">
                            <input type="email" name="destino" placeholder="Correo destino" value={emailData.destino} onChange={handleInputChange} /><br />
                            <input type="text" name="origen" placeholder="Nombre del remitente" value={emailData.origen} onChange={handleInputChange} disabled /><br />
                            <textarea name="texto" placeholder="nombre:, codigo:" value={emailData.texto} onChange={handleInputChange} /><br />
                            <button onClick={handleSendEmail}>Enviar</button>
                            <button onClick={() => setInviteModalOpen(false)}>Cancelar</button>
                        </div>
                    )}
                    <hr /><br />

                    

                    
                    <Button onClick={() => setIsModalOpen(true)}>Agregar Atributo</Button>

                        {isModalOpen && (
                        <Modal>
                            <h2>Agregar Nueva Propiedad</h2>
                            <label>Nombre:</label>
                            <input
                            type="text"
                            value={propertyName}
                            onChange={(e) => setPropertyName(e.target.value)}
                            />
                            <label>Tipo:</label>
                            <input
                            type="text"
                            value={propertyType}
                            onChange={(e) => setPropertyType(e.target.value)}
                            />
                            <label>Visibilidad:</label>
                            <select
                            value={propertyVisibility}
                            onChange={(e) => setPropertyVisibility(e.target.value)}
                            >
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                            <option value="protected">Protected</option>
                            </select>
                            <Button onClick={handleSubmitProperty}>Guardar Propiedad</Button>
                        </Modal>
                        )}




                    <div>
                    {/*<button type="submit" onClick={() => setModalOpen(true)}><strong>Add atributos</strong></button><br />*/}
                        <p><strong>HERRAMIENTAS:</strong></p>
                        <Button className="btn" onClick={() => myDiagram.commandHandler.undo()} style={{ width: '150px', margin: '5px' }}>Deshacer</Button><br />
                        <Button className="btn" onClick={() => myDiagram.commandHandler.deleteSelection()} style={{ width: '150px', margin: '5px' }}>Eliminar Selección</Button><br />
                        <Button className="btn" onClick={() => myDiagram.commandHandler.selectAll()} style={{ width: '150px', margin: '5px' }}>Seleccionar Todo</Button><br /><br />
                        <Button className="btn" onClick={handleAddClass} style={{ width: '150px', margin: '5px' }}>Añadir Clase</Button><br />
                        <Button className="btn" onClick={handleAddLink} style={{ width: '150px', margin: '5px' }}>Añadir Asociación</Button>
                    

                    {/*     <Button onClick={() => saveDiagram(diagramaId, myDiagram.model.toJson())}>Guardar Diagramaaa</Button>*/}
                    </div>


                    <div>
                        <p><strong>EXPORTAR A:</strong></p>
                        <Button className="btn" onClick={descargarSVG} style={{ width: '120px', margin: '5px' }}>Formato SVG</Button><br />
                        <Button className="btn" onClick={descargarPNG} style={{ width: '120px', margin: '5px' }}>Formato PNG</Button>
                    </div>
                </div>

               
               


                <textarea
                    id="mySavedModel"
                    className='representacion-json'
                    value={modelJson}
                    onChange={(e) => setModelJson(e.target.value)}
                    style={{ display: 'none' }}
                />

                <div>
                {/* Contenedor donde se renderiza el diagrama */}
                <div className="diagram-component" ref={diagramRef}></div>
                </div>
              
               </div>
        </div>
    );
}

export default ClassDiagram;