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
    const documentIdRef = useRef(null);  
    const [myDiagram, setMyDiagram] = useState(null);
    const [modelJson, setModelJson] = useState(JSON.stringify({ class: "go.GraphLinksModel", nodeDataArray: [], linkDataArray: [] }, null, 2));
    const { isInviteModalOpen, setInviteModalOpen, emailData, setEmailData, handleInputChange, handleSendEmail } = Invitacion();
    const { diagramaId} = useParams();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const diagramaNombre = params.get('nombre');
    const { logout } = useAuth();

    const [diagram, setDiagram] = useState(null); // El diagrama de GoJS

    const [propertyName, setPropertyName] = useState('');
    const [propertyType, setPropertyType] = useState('');
    const [propertyVisibility, setPropertyVisibility] = useState('public'); // Puede ser public, private, protected
    const [isModalOpen, setIsModalOpen] = useState(false); // Control del modal


    const [isDocumentIdLoaded, setIsDocumentIdLoaded] = useState(false); // Estado para verificar si documentId está cargado
    // Función que obtiene el documentId y lo guarda en documentIdRef (sin causar re-render)
    const getDocumentIdByDiagramaIdWithoutRender = async (diagramaId) => {
        try {
        const diagramaCollection = collection(db, 'diagramas');
        const q = query(diagramaCollection, where('diagramaId', '==', diagramaId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            documentIdRef.current = doc.id; 
            console.log("DocumentId obtenido desde consulta (useRef):", doc.id);
        } else {
            console.error("No se encontró ningún documento con el diagramaId proporcionado.");
        }
        } catch (error) {
        console.error("Error obteniendo documentId:", error.message || error);
        }
    };


    //------------------------------------------------------------------------------------------
    //------------------------------------------------------------------------------------------
    // Initialize GoJS Diagram
    useEffect(() => {
        if (!diagramRef.current) return;  
    
        // Verificar si ya se obtuvo el documentId
        if (!documentIdRef.current && diagramaId && !isDocumentIdLoaded) {
            getDocumentIdByDiagramaIdWithoutRender(diagramaId)
                .then(() => {
                    console.log("DocumentId primera vez:", documentIdRef.current);
                    setIsDocumentIdLoaded(true);  // Marca como cargado el documentId
    
                    // Ahora que tenemos el documentId, inicializamos el diagrama
                    if (!myDiagram) {
                        const $ = go.GraphObject.make;
                        const diagram = $(go.Diagram, {
                            'undoManager.isEnabled': true,
                            'clickCreatingTool.archetypeNodeData': { text: 'Node', color: 'white' },
                            'draggingTool.dragsLink': true,
                            'dragSelectingTool.isEnabled': true,
                            "linkingTool.isEnabled": true,
                            "relinkingTool.isEnabled": true,
                            "draggingTool.isEnabled": true,
                            "isReadOnly": false,
                         //   "initialContentAlignment": go.Spot.Center,
                           //"initialContentAlignment": go.Spot.TopLeft,
                         //  "initialScale": 1,
                           "allowMove": true,
                           "allowZoom": false,
                        });
                        diagram.model = new go.GraphLinksModel([], []);
                        diagram.div = diagramRef.current;
                        setMyDiagram(diagram);  // Actualiza el estado solo la primera vez
                    }
                })
                .catch((error) => {
                    console.error("Error al obtener el documentId:", error);
                });}

                if (myDiagram && isDocumentIdLoaded) {
                    console.log('Inicializando nodos...');
                    myDiagram.model.startTransaction('Cargando nodos'); // Inicia la transacción
                    crearNodo(myDiagram);   
                    ListenersModificar(myDiagram);  
                    ListenersMovimiento(myDiagram, setModelJson); 
                    setModelJson(myDiagram.model.toJson());
                    ListenersEnlaces(myDiagram);

                    if (documentIdRef.current) {
                        console.log("El documentId es esto es para cargar :", documentIdRef.current);
                        loadModelData(documentIdRef.current); // Cargar datos del modelo usando el documentId
                    }
                    myDiagram.model.commitTransaction('Cargando nodos'); // Finaliza la transacción
                }
        return () => {
            if (myDiagram) {
                myDiagram.div = null;   // Desconecta el diagrama de su contenedor en el DOM
            }
        };
    }, [diagramRef, myDiagram, diagramaId, isDocumentIdLoaded]);
    

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

    //para el boton "Anadir clase"
    const handleAddClass = () => {
        if (!myDiagram || !(myDiagram instanceof go.Diagram)) {
            console.error("myDiagram is not initialized or is not an instance of go.Diagram");
            return;
        }

        const newNodeData = {
            key: generateKey(),  
            loc: '-50 -50',
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

        const updatedModelJson = JSON.stringify(myDiagram.model.toJson(), null, 2);
        setModelJson(updatedModelJson);
    } ;

    ///////////////////////////////////////////////////////////////////////////////////

    
    //////////////////////////////////////////////////////////////////////////////////       


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

    // Anadir listener para los enlaces
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




    // Añadir un listener para el evento 'SelectionMoved' del diagrama
    const ListenersMovimiento = (myDiagram, setModelJson) => {
        myDiagram.addDiagramListener('SelectionMoved', async (e) => {
            console.log("Evento SelectionMoved disparado");
    
            const movedParts = e.subject;
    
            if (movedParts instanceof go.Set) {
                await Promise.all(movedParts.map(async (part) => {
                    if (part instanceof go.Part) {
                        console.log("Parte movida:", part);
    
                        // Obtiene la nueva ubicación
                        let newLoc = part.position;
                        newLoc = go.Point.stringify(newLoc); // Asegúrate de que 'loc' esté correctamente formateado
    
                        // Crear el nuevo nodo con la estructura deseada
                        const nodeDataWithNewLoc = {
                            key: part.data.key,
                            name: part.data.name || part.data.text,
                            loc: newLoc,
                            attributes: part.data.attributes || [],
                            methods: part.data.methods || []
                        };
                        console.log("Nodo movido:", JSON.stringify(nodeDataWithNewLoc, null, 2));
    
                        // Actualiza el nodo en el modelo
                        myDiagram.model.setDataProperty(part.data, 'loc', newLoc);
                       // myDiagram.model.setDataProperty(part.data, 'name', nodeDataWithNewLoc.name);
                       // myDiagram.model.setDataProperty(part.data, 'attributes', nodeDataWithNewLoc.attributes);
                       // myDiagram.model.setDataProperty(part.data, 'methods', nodeDataWithNewLoc.methods);
    
                        // Asegúrate de que el modelo está actualizado
                        const updatedModelJson = myDiagram.model.toJson(); // Obtener la representación actualizada del modelo
                        console.log("Modelo actualizado:", updatedModelJson); // Depuración
                        await updateModelData(documentIdRef.current, updatedModelJson); // Actualiza el modelData en Firestore
    
                        // Actualiza el estado del modelo JSON en el estado local
                        setModelJson(updatedModelJson);
                    } else {
                        console.error("El elemento en movedParts no es una instancia de go.Part.");
                    }
                }));
            } else {
                console.error("e.subject no es ni un go.Set ni un go.Part.");
            }
        });
    };
    
    
    // Función para actualizar el modelData completo
    const updateModelData = async (documentId, updatedModelJson) => {
        try {
            if (!db) throw new Error("Firestore DB no está inicializado.");
            if (!documentId) throw new Error("documentId es indefinido o nulo.");
            if (!updatedModelJson) {throw new Error("updatedModelJson es indefinido.");}
    
            const docRef = doc(db, "diagramas", documentId);
    
            // Actualizar Firestore con el nuevo modelData
            await updateDoc(docRef, {
                modelData: updatedModelJson,
                updatedAt: new Date() 
            });
    
            console.log("Model data actualizado en Firebase correctamente");
        } catch (error) {
            console.error("Error actualizando modelData:", error.message || error);
        }
    };
    
    // Función para cargar los datos del modelo desde Firestore
    const loadModelData = async (documentId) => {
        try {
            const docRef = doc(db, "diagramas", documentId);
            const docSnap = await getDoc(docRef);
    
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log("Datos obtenidos de Firestore:", data);
    
                // Analizar la cadena JSON en un objeto
                const modelData = JSON.parse(data.modelData);
    
                // Verificar que modelData no esté vacío
                if (modelData.nodeDataArray && modelData.nodeDataArray.length > 0 || modelData.linkDataArray && modelData.linkDataArray.length > 0) {
                    if (myDiagram) {
                        // Actualizar el modelo del diagrama con los datos obtenidos
                        myDiagram.model = go.Model.fromJson(modelData);
    
                        // Reasignar las posiciones manualmente después de establecer el modelo
                        modelData.nodeDataArray.forEach((node) => {
                            const part = myDiagram.findPartForData(node);
                            if (part) {
                                const newLoc = go.Point.parse(node.loc); // Asegúrate de que loc esté en el formato "x y"
                                part.position = newLoc; // Reasignar la posición
                            }
                        });
    
                        // Forzar la actualización del diagrama
                        myDiagram.updateAllTargetBindings();
                        myDiagram.requestUpdate();
    
                        // Actualiza el estado del modelo JSON en el estado local
                        setModelJson(modelData);
                        console.log("Model data cargado correctamente:", modelData);
                    } else {
                        console.error("myDiagram no está definido.");
                    }
                } else {
                    console.warn("El campo modelData está vacío o es inválido.");
                }
            } else {
                console.error("No se encontró el documento.");
            }
        } catch (error) {
            console.error("Error cargando modelData:", error.message || error);
        } finally {
            // setIsLoading(false); // Finalizar el estado de carga si estás usando uno
        }
    };
    
    
    
   /* const loadModelData = async (documentId) => {
        try {
            const docRef = doc(db, "diagramas", documentId);
            const docSnap = await getDoc(docRef);
    
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log("Datos obtenidos de Firestore:", data);
    
                // Analizar la cadena JSON en un objeto
                const modelData = JSON.parse(data.modelData);
    
                // Verificar que modelData no esté vacío
                if (modelData.nodeDataArray && modelData.nodeDataArray.length > 0 || modelData.linkDataArray && modelData.linkDataArray.length > 0) {
                    if (myDiagram) {
                        // Actualizar el modelo del diagrama con los datos obtenidos
                        myDiagram.model = go.Model.fromJson(modelData);
    
                        // Asignar las posiciones manualmente
                        modelData.nodeDataArray.forEach((node) => {
                            const part = myDiagram.findPartForData(node);
                            if (part) {
                                const newLoc = go.Point.parse(node.loc); // Asegúrate de que loc esté en el formato "x y"
                                part.position = newLoc; // Reasignar la posición
                            }
                        });
    
                        // Forzar la actualización del diagrama
                        myDiagram.updateAllTargetBindings();
                        myDiagram.requestUpdate();
    
                        // Actualiza el estado del modelo JSON en el estado local
                        setModelJson(modelData);
                        console.log("Model data cargado correctamente:", modelData);
                    } else {
                        console.error("myDiagram no está definido.");
                    }
                } else {
                    console.warn("El campo modelData está vacío o es inválido.");
                }
            } else {
                console.error("No se encontró el documento.");
            }
        } catch (error) {
            console.error("Error cargando modelData:", error.message || error);
        } finally {
            // setIsLoading(false); // Finalizar el estado de carga si estás usando uno
        }
    };*/

   
    
    




  
  
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
                    

                    {/* <Button onClick={() => saveDiagram(diagramaId, myDiagram.model.toJson())}>Guardar Diagramaaa</Button>*/}
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