import React, { useState, useEffect, useRef } from 'react';
import { ReactDiagram } from 'gojs-react';
import * as go from 'gojs';
import { Button } from "@/components/ui/button";
import { Invitacion } from '../invitacion.jsx';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/authContext.jsx';
import { doc, onSnapshot, setDoc, collection, addDoc, updateDoc, getDoc, getDocs,query,where } from "firebase/firestore";
import { db } from '../../firebase.jsx';


//let myDiagram;
const generateKey = () => (Math.random() * 1e17).toString(36);

let currentKey = 0; // Inicializa el contador
const generateKeyEnlace = () => {currentKey += 1; return currentKey.toString(); };

let generatekeyEnlace2 = () => {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, ''); // Mantiene la parte de fecha-hora
    const randomPart = Math.floor(Math.random() * 10000); // Añade un número aleatorio entre 0 y 9999
    return `enlace_${timestamp}_${randomPart}`;
};
//console.log(generatekeyEnlace2()); // Salida ejemplo: enlace_20241002T143512123

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
    const [nodes, setNodes] = useState([]); // Estado para almacenar nodos
    const [fromNode, setFromNode] = useState(null); // Estado para el nodo de origen
    const [toNode, setToNode] = useState(null); // Estado para el nodo de destino
    //const [linkType, setLinkType] = useState('Association'); // Estado para el tipo de enlace
    const [linkType, setLinkType] = useState(''); 

    // Función que obtiene el documentId y lo guarda en documentIdRef (sin causar re-render)
    const getDocumentIdByDiagramaIdWithoutRender = async (diagramaId) => {
        try {
        const diagramaCollection = collection(db, 'diagramas');
        const q = query(diagramaCollection, where('diagramaId', '==', diagramaId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            documentIdRef.current = doc.id; 
          //  console.log("DocumentId obtenido desde consulta (useRef):", doc.id);
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
                         //  "initialContentAlignment": go.Spot.Center,
                         //  "initialContentAlignment": go.Spot.TopLeft,
                         //  "initialScale": 1,
                            "allowMove": true,
                            "allowZoom": false,
                            "clickCreatingTool.isEnabled": false, // Desactiva la herramienta de creación de nodos
                        });
                        diagram.model = new go.GraphLinksModel([], []);
                        diagram.div = diagramRef.current;
 
                        createLinkTemplates(diagram);// Define plantillas de enlace cuando se inicializa el diagrama
                        crearNodo(diagram);  
                        setMyDiagram(diagram);  // Actualiza el estado solo la primera vez
                    }
                })
                .catch((error) => {
                    console.error("Error al obtener el documentId:", error);
                });}

                if (myDiagram && isDocumentIdLoaded) {
                    console.log('Inicializando nodos...');
                    const unsubscribe = subscribeToModelData(documentIdRef.current);


                    myDiagram.model.startTransaction('Cargando nodos'); // Inicia la transacción
                    crearNodo(myDiagram);  
                    createLinkTemplates(myDiagram)
                    ListenersMovimiento(myDiagram, setModelJson);
                    //ListenerAddNode();
                    ListenerAddNodeEdit();
                    setModelJson(myDiagram.model.toJson());

                    // Llama a las nuevas funciones para manejar la selección de enlaces y edición de texto
                    handleLinkSelection(myDiagram, documentIdRef.current);
                    handleTextEdited(myDiagram, documentIdRef.current);

                  


                    if (documentIdRef.current) {
                        console.log("El documentId es esto es para cargar el ModelData:", documentIdRef.current);
                        loadModelData(documentIdRef.current); 
                    }
                    myDiagram.model.commitTransaction('Cargando nodos'); // Finaliza la transacción
                }

            return () => {
            if (myDiagram) {
                myDiagram.div = null;   // Desconecta el diagrama de su contenedor en el DOM
            }
        };
    }, [diagramRef, myDiagram, diagramaId, isDocumentIdLoaded]);
    

    // Función para crear enlaces con etiquetas
    useEffect(() => {
        if (myDiagram) {
            //movable: true
            const linkStyle = () => ({routing: go.Link.Normal, curve: go.Link.Bezier, corner: 5, selectable: true, relinkableFrom: true, relinkableTo: true});
            myDiagram.linkTemplateMap.clear();
    
            // Dependiendo del tipo de enlace seleccionado (linkType), se configura el diagrama
            if (linkType === 'Association') {
                myDiagram.linkTemplateMap.add('Association',
                    new go.Link(linkStyle())
                        .add(
                            new go.Shape(), // Forma del enlace
            
                            // Etiqueta de inicio editable
                            new go.TextBlock()
                                .bind(new go.Binding("text", "startLabel").makeTwoWay()) 
                                .setProperties({
                                    segmentIndex: 0,
                                    segmentOffset: new go.Point(15, -10),
                                    alignmentFocus: go.Spot.Left,
                                    editable: true,
                                    name: "startLabel"
                                }),
            
                            // Etiqueta del centro editable
                            new go.TextBlock()
                                .bind(new go.Binding("text", "centerLabel").makeTwoWay()) 
                                .setProperties({
                                    segmentFraction: 0.5,
                                    alignmentFocus: go.Spot.Center,
                                    editable: true,
                                    name: "centerLabel"
                                }),
            
                            // Etiqueta de fin editable
                            new go.TextBlock()
                                .bind(new go.Binding("text", "endLabel").makeTwoWay()) 
                                .setProperties({
                                    segmentIndex: -1,
                                    segmentOffset: new go.Point(-15, -10),
                                    alignmentFocus: go.Spot.Right,
                                    editable: true,
                                    name: "endLabel"
                                })
                        )
                );
            }
            
            if (linkType === 'Generalization') {
                myDiagram.linkTemplateMap.add('Generalization',
                    new go.Link(linkStyle())
                    .add(
                        new go.Shape(), 
                        new go.Shape({ toArrow: 'Triangle', fill: 'white' }) 
                    )
                );
            }
            
            if (linkType === 'Composition') {
                myDiagram.linkTemplateMap.add('Composition',
                    new go.Link(linkStyle())
                    .add(
                        new go.Shape(), // Línea del enlace
                        new go.Shape({ fromArrow: 'StretchedDiamond', scale: 1.3 }), // Diamante en el inicio
                        
                        // Etiqueta de inicio editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "startLabel").makeTwoWay()) 
                            .setProperties({ segmentIndex: 0, segmentOffset: new go.Point(15, -10), alignmentFocus: go.Spot.Left, editable: true }),
            
                        // Etiqueta del centro editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "centerLabel").makeTwoWay()) 
                            .setProperties({ segmentFraction: 0.5, alignmentFocus: go.Spot.Center, editable: true }),
            
                        // Etiqueta de fin editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "endLabel").makeTwoWay()) 
                            .setProperties({ segmentIndex: -1, segmentOffset: new go.Point(-15,-10), alignmentFocus: go.Spot.Right, editable: true })
                    )
                );
            }
            
            if (linkType === 'Aggregation') {
                myDiagram.linkTemplateMap.add('Aggregation',
                    new go.Link(linkStyle())
                    .add(
                        new go.Shape(),
                        new go.Shape({ fromArrow: 'StretchedDiamond', fill: 'white', scale: 1.3 }),
            
                        // Etiqueta de inicio editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "startLabel").makeTwoWay()) 
                            .setProperties({ segmentIndex: 0, segmentOffset: new go.Point(15, -10), alignmentFocus: go.Spot.Left, editable: true }),
            
                        // Etiqueta del centro editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "centerLabel").makeTwoWay()) 
                            .setProperties({ segmentFraction: 0.5, alignmentFocus: go.Spot.Center, editable: true }),
            
                        // Etiqueta de fin editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "endLabel").makeTwoWay()) 
                            .setProperties({ segmentIndex: -1, segmentOffset: new go.Point(-15,-10), alignmentFocus: go.Spot.Right, editable: true })
                    )
                );
            }
            
            if (linkType === 'AssociationClass') {
                myDiagram.linkTemplateMap.add('AssociationClass',
                    new go.Link(linkStyle())
                    .add(
                        new go.Shape(),  // Línea del enlace
                        new go.Panel("Auto",  // Panel que contiene el cuadrado y el texto
                            {
                                alignmentFocus: go.Spot.Center, // Alineación al centro
                                segmentFraction: 0.5  // Colocar el panel en el centro del enlace
                            }
                        ).add(
                            // Rectángulo como fondo
                            new go.Shape("Rectangle", {
                                fill: "lightgray",  // Color de fondo
                                stroke: "black",  // Color del borde
                                strokeWidth: 1.5,  // Grosor del borde
                                minSize: new go.Size(60, 60) // Tamaño mínimo
                            }),
                            
                            // Crear un Panel de Tabla para organizar el contenido
                            new go.Panel("Table", {
                                defaultRowSeparatorStroke: "black",
                                margin: new go.Margin(0, 0, 0, 0)  // Margen para el panel
                            }).add(
                                // Header "Clase"
                                new go.TextBlock('Clase', {
                                    row: 0,
                                    columnSpan: 2,
                                    margin: 3,
                                   // alignment: go.Spot.Center,
                                    font: 'bold 12pt sans-serif',
                                    isMultiline: true,
                                    maxWidth: 100,
                                    editable: true,  // Permite editar
                                })
                                .bindTwoWay('text', 'namee'),  // Aquí el nombre de la clase es editable
            
                                // Properties header
                                new go.TextBlock('Atributos', {
                                    row: 1,
                                    columnSpan: 2,
                                    alignment: go.Spot.Center,
                                    font: 'italic 10pt sans-serif'
                                })
                                .bindObject('visible', 'visible', v => !v, undefined, 'PROPERTIES'),
            
                                // Properties panel
                                new go.Panel('Vertical', {
                                    name: 'PROPERTIES',
                                    row: 1,
                                    margin: 3,
                                    stretch: go.Stretch.Horizontal,
                                    defaultAlignment: go.Spot.Left,
                                    itemTemplate: propertyTemplate,
                                })
                                .bindTwoWay('itemArray', 'properties'),
            
                                // Agregar botón de atributos
                                go.GraphObject.make("Button",
                                    {
                                        row: 1,
                                        column: 0,
                                        alignment: go.Spot.TopLeft,
                                        click: (e, obj) => addPropertyToNode(e, obj)
                                    },
                                    new go.TextBlock("+", { font: "10pt sans-serif" })
                                ),
            
                                // Expand button for properties
                                go.GraphObject.build("PanelExpanderButton", {
                                    row: 1,
                                    column: 1,
                                    alignment: go.Spot.TopRight,
                                    visible: false,
                                }, "PROPERTIES")
                                .bind('visible', 'properties', arr => arr.length > 0),
            
                                // Methods header
                                new go.TextBlock('Métodos', {
                                    row: 2,
                                    columnSpan: 2,
                                    alignment: go.Spot.Center,
                                    font: 'italic 10pt sans-serif'
                                })
                                .bindObject('visible', 'visible', v => !v, undefined, 'METHODS'),
            
                                // Methods panel
                                new go.Panel('Vertical', {
                                    name: 'METHODS',
                                    row: 2,
                                    margin: 3,
                                    stretch: go.Stretch.Horizontal,
                                    defaultAlignment: go.Spot.Left,
                                    itemTemplate: methodTemplate
                                })
                                .bindTwoWay('itemArray', 'methods'),
            
                                // Agregar botón de métodos
                                go.GraphObject.make("Button",
                                    {
                                        row: 2,
                                        column: 0,
                                        alignment: go.Spot.TopLeft,
                                        click: (e, obj) => addMethodToNode(e, obj)
                                    },
                                    new go.TextBlock("+", { font: "10pt sans-serif" })
                                ),
            
                                // Expand button for methods
                                go.GraphObject.build("PanelExpanderButton", {
                                    row: 2,
                                    column: 1,
                                    alignment: go.Spot.TopRight,
                                    visible: false
                                }, "METHODS")
                                .bind('visible', 'methods', arr => arr.length > 0)
                            )
                        )
                    )
                );
            
            
            // Primero, asegúrate de tener la plantilla para el tipo de enlace 'AssociationClass'
            /*myDiagram.linkTemplateMap.add('AssociationClass',
        new go.Link(linkStyle())
        .add(
            new go.Shape(),  // Línea del enlace
            new go.Panel("Auto",  // Panel que contiene el cuadrado y el texto
                {
                    alignmentFocus: go.Spot.Center, // Alineación al centro
                    segmentFraction: 0.5  // Colocar el panel en el centro del enlace
                }
            ).add(
                // Rectángulo como fondo
                new go.Shape("Rectangle", {
                    fill: "lightgray",  // Color de fondo
                    stroke: "black",  // Color del borde
                    strokeWidth: 1.5,  // Grosor del borde
                    minSize: new go.Size(60, 60) // Tamaño mínimo
                }),
                
                // Crear un Panel de Tabla para organizar el contenido
                new go.Panel("Table", {
                    defaultRowSeparatorStroke: "black",
                    margin: new go.Margin(0, 0, 0, 0)  // Margen para el panel
                }).add(
                    // Header "Clase"
                    new go.TextBlock('Clase', {
                        row: 0,
                        columnSpan: 2,
                        margin: 3,  // Cambiar margen si es necesario
                        alignment: go.Spot.Center,
                        font: 'bold 12pt sans-serif',
                        isMultiline: true,  // Permitir multilinea si es necesario
                        maxWidth: 100,  // Limitar el ancho máximo
                        editable: true,
                    })
                    .bindTwoWay('text', 'name'),

                    // Properties header
                    new go.TextBlock('Atributos', {
                        row: 1,
                        columnSpan: 2,
                        alignment: go.Spot.Center,
                        font: 'italic 10pt sans-serif'
                    })
                    .bindObject('visible', 'visible', v => !v, undefined, 'PROPERTIES'),

                    // Properties panel
                    new go.Panel('Vertical', {
                        name: 'PROPERTIES',
                        row: 1,
                        margin: 3,
                        stretch: go.Stretch.Horizontal,
                        defaultAlignment: go.Spot.Left,
                        itemTemplate: propertyTemplate,
                    })
                    .bindTwoWay('itemArray', 'properties'),

                    // Agregar botón de atributos
                    go.GraphObject.make("Button",
                        {
                            row: 1,
                            column: 0,
                            alignment: go.Spot.TopLeft,
                            click: (e, obj) => addPropertyToNode(e, obj)
                        },
                        new go.TextBlock("+", { font: "10pt sans-serif" })
                    ),

                    // Expand button for properties
                    go.GraphObject.build("PanelExpanderButton", {
                        row: 1,
                        column: 1,
                        alignment: go.Spot.TopRight,
                        visible: false,
                    }, "PROPERTIES")
                    .bind('visible', 'properties', arr => arr.length > 0),

                    // Methods header
                    new go.TextBlock('Métodos', {
                        row: 2,
                        columnSpan: 2,
                        alignment: go.Spot.Center,
                        font: 'italic 10pt sans-serif'
                    })
                    .bindObject('visible', 'visible', v => !v, undefined, 'METHODS'),

                    // Methods panel
                    new go.Panel('Vertical', {
                        name: 'METHODS',
                        row: 2,
                        margin: 3,
                        stretch: go.Stretch.Horizontal,
                        defaultAlignment: go.Spot.Left,
                        itemTemplate: methodTemplate
                    })
                    .bindTwoWay('itemArray', 'methods'),

                    // Agregar botón de métodos
                    go.GraphObject.make("Button",
                        {
                            row: 2,
                            column: 0,
                            alignment: go.Spot.TopLeft,
                            click: (e, obj) => addMethodToNode(e, obj)
                        },
                        new go.TextBlock("+", { font: "10pt sans-serif" })
                    ),

                    // Expand button for methods
                    go.GraphObject.build("PanelExpanderButton", {
                        row: 2,
                        column: 1,
                        alignment: go.Spot.TopRight,
                        visible: false
                    }, "METHODS")
                    .bind('visible', 'methods', arr => arr.length > 0)
                )
            )
        )
    );*/


            
            }
            
            if (linkType === 'Realization') {
                myDiagram.linkTemplateMap.add('Realization',
                    new go.Link(linkStyle())
                    .add(
                        new go.Shape({ strokeDashArray: [3, 2] }), // Línea discontinua para "Realization"
                        new go.Shape({ toArrow: 'Triangle', fill: 'white' }),
            
                        // Etiqueta de inicio editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "startLabel").makeTwoWay()) 
                            .setProperties({ segmentIndex: 0, segmentOffset: new go.Point(15, -10), alignmentFocus: go.Spot.Left, editable: true }),
            
                        // Etiqueta del centro editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "centerLabel").makeTwoWay()) 
                            .setProperties({ segmentFraction: 0.5, alignmentFocus: go.Spot.Center, editable: true }),
            
                        // Etiqueta de fin editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "endLabel").makeTwoWay()) 
                            .setProperties({ segmentIndex: -1, segmentOffset: new go.Point(-15, -10), alignmentFocus: go.Spot.Right, editable: true })
                    )
                );
            }
            
            if (linkType === 'Dependency') {
                myDiagram.linkTemplateMap.add('Dependency',
                    new go.Link(linkStyle())
                    .add(
                        new go.Shape({ strokeDashArray: [3, 2] }),
                        new go.Shape({ toArrow: 'OpenTriangle' }),
            
                        // Etiqueta de inicio editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "startLabel").makeTwoWay()) 
                            .setProperties({ segmentIndex: 0, segmentOffset: new go.Point(15, -10), alignmentFocus: go.Spot.Left, editable: true }),
            
                        // Etiqueta del centro editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "centerLabel").makeTwoWay()) 
                            .setProperties({ segmentFraction: 0.5, alignmentFocus: go.Spot.Center, editable: true }),
            
                        // Etiqueta de fin editable
                        new go.TextBlock()
                            .bind(new go.Binding("text", "endLabel").makeTwoWay()) 
                            .setProperties({ segmentIndex: -1, segmentOffset: new go.Point(-15, -10), alignmentFocus: go.Spot.Right, editable: true })
                    )
                );
            }
        }
    }, [linkType]); 


    //--------------------------------------------------------------------------------------------------------------
    //--------------------------------------------------------------------------------------------------------------
    // TODO DE NODO O CLASE

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
           // .bind('isUnderline', 'scope', s => s[0] === 'c'),
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
    const methodTemplate = new go.Panel('Horizontal')
        .add(
            new go.TextBlock({ isMultiline: false, editable: false, width: 12 })
                .bind('text', 'visibility', convertVisibility), // Simboliza la visibilidad
            new go.TextBlock({ isMultiline: false, editable: true })
                .bindTwoWay('text', 'name')                     // Nombre del método
                .bind('isUnderline', 'scope', s => s[0] === 'c'), // Subrayar si es un método estático
            new go.TextBlock('')                            // Parámetros del método
                .bind('text', 'parameters', function(parr) {
                    var s = '(';
                    for (var i = 0; i < parr.length; i++) {
                        var param = parr[i];
                        if (i > 0) s += ', ';
                        s += param.name + ': ' + param.type;
                    }
                    return s + ')';
                }),
            new go.TextBlock('')                               // Tipo de retorno
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
                        // Header
                        new go.TextBlock('   clase   ', {
                            row: 0, columnSpan: 2, margin: 3, alignment: go.Spot.Center,
                            font: 'bold 12pt sans-serif',
                            isMultiline: false, editable: true
                        })
                        .bindTwoWay('text', 'name'),

                        // Properties header
                        new go.TextBlock('Atributos', { row: 1, alignment: go.Spot.Center, columnSpan: 2, font: 'italic 10pt sans-serif' })
                            .bindObject('visible', 'visible', v => !v, undefined, 'PROPERTIES'),

                        // Properties panel
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

                        // agregar boton atributos
                        go.GraphObject.make("Button",
                            {
                                row: 1,
                                column: 0,
                                alignment: go.Spot.TopLeft,
                                click: (e, obj) => addPropertyToNode(e, obj)
                            },
                            new go.TextBlock("+", { font: "10pt sans-serif" })
                        ),

                        // Expand button for properties
                        go.GraphObject.build("PanelExpanderButton", {
                            row: 1,
                            column: 1,
                            alignment: go.Spot.TopRight,
                            visible: false,
                        }, "PROPERTIES")
                        .bind('visible', 'properties', arr => arr.length > 0),

                        // Methods header
                        new go.TextBlock('Metodos', { row: 2, alignment: go.Spot.Center, columnSpan: 2, font: 'italic 10pt sans-serif' })
                            .bindObject('visible', 'visible', v => !v, undefined, 'METHODS'),

                        // Methods panel
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

                        // agregar boton metodos
                        go.GraphObject.make("Button",
                            {
                                row: 2,
                                column: 0,
                                alignment: go.Spot.TopLeft,
                                click: (e, obj) => addMethodToNode(e, obj)
                            },
                            new go.TextBlock("+", { font: "10pt sans-serif" })  // Cambiado de "-" a "+"
                        ),

                        // Expand button for methods
                        go.GraphObject.build("PanelExpanderButton", {
                            row: 2,
                            column: 1,
                            alignment: go.Spot.TopRight,
                            visible: false
                        }, "METHODS")
                        .bind('visible', 'methods', arr => arr.length > 0)
                    )
            );
    };

    // Función para agregar propiedad
    function addPropertyToNode(e, obj) {
        const node = obj.part; // Get the node from the button
    
        // Asegúrate de que el nodo y sus datos estén definidos
        if (!node || !node.data) {
            console.error("No se puede agregar propiedad: nodo o datos del nodo no definidos");
            return;
        }
    
        const properties = node.data.properties || []; // Get existing properties or initialize
    
        // Collect new property details from user input
        const propertyName = prompt("Enter property name:");
        const propertyVisibility = prompt("Enter visibility (public, private, protected, package):");
        const propertyType = prompt("Enter property type:");
        const propertyDefault = prompt("Enter default value (optional):");
    
        // Validate the inputs
        if (propertyName) {
            // Asegúrate de que el diagrama esté inicializado antes de comenzar la transacción
            if (!myDiagram) {
                console.error("El diagrama no está definido");
                return;
            }
    
            myDiagram.startTransaction("Add Property"); //inicia la transacción
    
            // Agrega la nueva propiedad
            properties.push({
                visibility: propertyVisibility || "public",  // Valor predeterminado si está vacío
                name: propertyName,
                type: propertyType || "String",  // Valor predeterminado si está vacío
                default: propertyDefault || ""  // Valor predeterminado si está vacío
            });
    
            // Update the node data with the new properties array
            myDiagram.model.setDataProperty(node.data, 'properties', properties);
    
            // Trigger a diagram update by modifying the node's data
            myDiagram.model.updateTargetBindings(node.data);
    
            myDiagram.commitTransaction("Add Property");  //finaliza la transacción
        } else {
            alert("Property name is required!");
        }
    }
        
    // Función para agregar método
    function addMethodToNode(e, obj) {
        const node = obj.part; // Obtener el nodo desde el botón
        const methods = node.data.methods || []; // Obtener métodos existentes o inicializar el arreglo
    
        // Solicitar detalles del nuevo método al usuario
        const methodName = prompt("Enter method name:");
        const methodVisibility = prompt("Enter visibility (public, private, protected, package):");
        const methodType = prompt("Enter return type (optional):");
        const methodParams = prompt("Enter parameters (format: name:type, name:type):");
    
        // Validar los inputs del método
        if (methodName) {
            myDiagram.startTransaction("Add Method"); // Iniciar la transacción
            // Parsear los parámetros ingresados por el usuario
            let parameters = [];
            if (methodParams) {
                parameters = methodParams.split(',').map(param => {
                    const [name, type] = param.split(':').map(s => s.trim());
                    return { name: name.trim(), type: type ? type.trim() : "" }; // Asegurarse de que "type" no sea undefined
                });
            }
    
            // Agregar el nuevo método al arreglo de métodos con la estructura correcta
            methods.push({
                visibility: methodVisibility || 'public',
                name: methodName,
                type: methodType || '',
                parameters: parameters
            });
    
            // Actualizar el nodo con los métodos nuevos
            myDiagram.model.setDataProperty(node.data, 'methods', methods);
            
            // Actualizar las vinculaciones de la interfaz
            myDiagram.model.updateTargetBindings(node.data);
            
            myDiagram.commitTransaction("Add Method"); // Finalizar la transacción
        } else {
            alert("Method name is required!");
        }
    }
    
    // Boton para el boton "Anadir clase"
    const handleAddClass = () => {
        if (!myDiagram || !(myDiagram instanceof go.Diagram)) {
            console.error("myDiagram is not initialized or is not an instance of go.Diagram");
            return;
        }

        const newNodeData = {
            key: generateKey(),  
            loc: '-50 -50',
            properties: [],
            methods: [],
            name: "New Class" 
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
    // TODO DE ENLACES O RELACION

    // Define the link template para load
    const createLinkTemplates = (diagram) => {
        if (!diagram) {
            console.error("El diagrama no está definido.");
            return;
        }
    
        const linkStyle = () => ({ routing: go.Link.Normal, curve: go.Link.Bezier,corner: 5,selectable: true,relinkableFrom: true,relinkableTo: true,});

        diagram.linkTemplateMap.add('Association',
            new go.Link(linkStyle())
                .add(
                    new go.Shape(), // Forma del enlace
    
                    // Etiqueta de inicio editable
                    new go.TextBlock()
                        .bind(new go.Binding("text", "startLabel").makeTwoWay()) // Usando Binding explícitamente
                        .setProperties({segmentIndex: 0,segmentOffset: new go.Point(15, -10),alignmentFocus: go.Spot.Left,editable: true,name: "startLabel"}),
    
                    // Etiqueta del centro editable
                    new go.TextBlock()
                        .bind(new go.Binding("text", "centerLabel").makeTwoWay()) // Usando Binding explícitamente
                        .setProperties({segmentFraction: 0.5,alignmentFocus: go.Spot.Center,editable: true,name: "centerLabel"}),
    
                    // Etiqueta de fin editable
                    new go.TextBlock()
                        .bind(new go.Binding("text", "endLabel").makeTwoWay()) // Usando Binding explícitamente
                        .setProperties({segmentIndex: -1, segmentOffset: new go.Point(-15, -10),alignmentFocus: go.Spot.Right,editable: true,name: "endLabel"})
                )
        );
        
        diagram.linkTemplateMap.add('Generalization',
            new go.Link(linkStyle())
                .add(
                    new go.Shape(), 
                    new go.Shape({ toArrow: 'Triangle', fill: 'white' })
                )
        );

        diagram.linkTemplateMap.add('Composition',
            new go.Link(linkStyle())
                .add(
                    new go.Shape(), // Línea del enlace
                    new go.Shape({ fromArrow: 'StretchedDiamond', scale: 1.3 }), // Diamante en el inicio
                    
                    // Etiqueta de inicio editable
                    new go.TextBlock()
                        .bind(new go.Binding("text", "startLabel").makeTwoWay()) 
                        .setProperties({ segmentIndex: 0, segmentOffset: new go.Point(15, -10), alignmentFocus: go.Spot.Left, editable: true }),

                    // Etiqueta del centro editable
                    new go.TextBlock()
                        .bind(new go.Binding("text", "centerLabel").makeTwoWay()) 
                        .setProperties({ segmentFraction: 0.5, alignmentFocus: go.Spot.Center, editable: true }),

                    // Etiqueta de fin editable
                    new go.TextBlock()
                        .bind(new go.Binding("text", "endLabel").makeTwoWay()) 
                        .setProperties({ segmentIndex: -1, segmentOffset: new go.Point(-15,-10), alignmentFocus: go.Spot.Right, editable: true })
                )
        );

        diagram.linkTemplateMap.add('Aggregation',
            new go.Link(linkStyle())
                .add(
                    new go.Shape(),
                    new go.Shape({ fromArrow: 'StretchedDiamond', fill: 'white', scale: 1.3 }),

                    // Etiqueta de inicio editable
                    new go.TextBlock()
                        .bind(new go.Binding("text", "startLabel").makeTwoWay()) 
                        .setProperties({ segmentIndex: 0, segmentOffset: new go.Point(15, -10), alignmentFocus: go.Spot.Left, editable: true }),

                    // Etiqueta del centro editable
                    new go.TextBlock()
                        .bind(new go.Binding("text", "centerLabel").makeTwoWay()) 
                        .setProperties({ segmentFraction: 0.5, alignmentFocus: go.Spot.Center, editable: true }),

                    // Etiqueta de fin editable
                    new go.TextBlock()
                        .bind(new go.Binding("text", "endLabel").makeTwoWay()) 
                        .setProperties({ segmentIndex: -1, segmentOffset: new go.Point(-15,-10), alignmentFocus: go.Spot.Right, editable: true })
                )
        );

        diagram.linkTemplateMap.add('AssociationClass',
            new go.Link(linkStyle())
                .add(
                    new go.Shape(),  // Línea del enlace
                    new go.Panel("Auto",  // Panel que contiene el cuadrado y el texto
                        {
                            alignmentFocus: go.Spot.Center, // Alineación al centro
                            segmentFraction: 0.5  // Colocar el panel en el centro del enlace
                        }
                    ).add(
                        // Rectángulo como fondo
                        new go.Shape("Rectangle", {
                            fill: "lightgray",  // Color de fondo
                            stroke: "black",  // Color del borde
                            strokeWidth: 1.5,  // Grosor del borde
                            minSize: new go.Size(60, 60) // Tamaño mínimo
                        }),
                        
                        // Crear un Panel de Tabla para organizar el contenido
                        new go.Panel("Table", {
                            defaultRowSeparatorStroke: "black",
                            margin: new go.Margin(0, 0, 0, 0)  // Margen para el panel
                        }).add(
                            // Header "Clase"
                            new go.TextBlock('Clase', {
                                row: 0,
                                columnSpan: 2,
                                margin: 3,
                               // alignment: go.Spot.Center,
                                font: 'bold 12pt sans-serif',
                                isMultiline: true,
                                maxWidth: 100,
                                editable: true,  // Permite editar
                            })
                            .bindTwoWay('text', 'namee'), // Aquí el nombre de la clase es editable

                            // Properties header
                            new go.TextBlock('Atributos', {
                                row: 1,
                                columnSpan: 2,
                                alignment: go.Spot.Center,
                                font: 'italic 10pt sans-serif'
                            })
                            .bindObject('visible', 'visible', v => !v, undefined, 'PROPERTIES'),

                            // Properties panel
                            new go.Panel('Vertical', {
                                name: 'PROPERTIES',
                                row: 1,
                                margin: 3,
                                stretch: go.Stretch.Horizontal,
                                defaultAlignment: go.Spot.Left,
                                itemTemplate: propertyTemplate,
                            })
                            .bindTwoWay('itemArray', 'properties'),

                            // Agregar botón de atributos
                            go.GraphObject.make("Button",
                                {
                                    row: 1,
                                    column: 0,
                                    alignment: go.Spot.TopLeft,
                                    click: (e, obj) => addPropertyToNode(e, obj)
                                },
                                new go.TextBlock("+", { font: "10pt sans-serif" })
                            ),

                            // Expand button for properties
                            go.GraphObject.build("PanelExpanderButton", {
                                row: 1,
                                column: 1,
                                alignment: go.Spot.TopRight,
                                visible: false,
                            }, "PROPERTIES")
                            .bind('visible', 'properties', arr => arr.length > 0),

                            // Methods header
                            new go.TextBlock('Métodos', {
                                row: 2,
                                columnSpan: 2,
                                alignment: go.Spot.Center,
                                font: 'italic 10pt sans-serif'
                            })
                            .bindObject('visible', 'visible', v => !v, undefined, 'METHODS'),

                            // Methods panel
                            new go.Panel('Vertical', {
                                name: 'METHODS',
                                row: 2,
                                margin: 3,
                                stretch: go.Stretch.Horizontal,
                                defaultAlignment: go.Spot.Left,
                                itemTemplate: methodTemplate
                            })
                            .bind('itemArray', 'methods'),

                            // Agregar botón de métodos
                            go.GraphObject.make("Button",
                                {
                                    row: 2,
                                    column: 0,
                                    alignment: go.Spot.TopLeft,
                                    click: (e, obj) => addMethodToNode(e, obj)
                                },
                                new go.TextBlock("+", { font: "10pt sans-serif" })
                            ),

                            // Expand button for methods
                            go.GraphObject.build("PanelExpanderButton", {
                                row: 2,
                                column: 1,
                                alignment: go.Spot.TopRight,
                                visible: false
                            }, "METHODS")
                            .bind('visible', 'methods', arr => arr.length > 0)
                        )
                    )
                )
            );

        diagram.linkTemplateMap.add('Realization',
            new go.Link(linkStyle())
                .add(
                    new go.Shape({ strokeDashArray: [3, 2] }), // Línea discontinua
                    new go.Shape({ toArrow: 'Triangle', fill: 'white' }),
                    new go.TextBlock()
                        .bind(new go.Binding("text", "startLabel").makeTwoWay())
                        .setProperties({ segmentIndex: 0, segmentOffset: new go.Point(15, -10), alignmentFocus: go.Spot.Left, editable: true }),
                    new go.TextBlock()
                        .bind(new go.Binding("text", "centerLabel").makeTwoWay()) 
                        .setProperties({ segmentFraction: 0.5, alignmentFocus: go.Spot.Center, editable: true }),
                    new go.TextBlock()
                        .bind(new go.Binding("text", "endLabel").makeTwoWay()) 
                        .setProperties({ segmentIndex: -1, segmentOffset: new go.Point(-15, -10), alignmentFocus: go.Spot.Right, editable: true })
                )
        );

        diagram.linkTemplateMap.add('Dependency',
            new go.Link(linkStyle())
                .add(
                    new go.Shape({ strokeDashArray: [3, 2] }),
                    new go.Shape({ toArrow: 'OpenTriangle' }),
                    new go.TextBlock()
                        .bind(new go.Binding("text", "startLabel").makeTwoWay()) 
                        .setProperties({ segmentIndex: 0, segmentOffset: new go.Point(15, -10), alignmentFocus: go.Spot.Left, editable: true }),
                    new go.TextBlock()
                        .bind(new go.Binding("text", "centerLabel").makeTwoWay()) 
                        .setProperties({ segmentFraction: 0.5, alignmentFocus: go.Spot.Center, editable: true }),
                    new go.TextBlock()
                        .bind(new go.Binding("text", "endLabel").makeTwoWay()) 
                        .setProperties({ segmentIndex: -1, segmentOffset: new go.Point(-15, -10), alignmentFocus: go.Spot.Right, editable: true })
                )
        );

    };

    // Botón para "Añadir enlace"     originalllllllllllll
    const handleAddLink = () => {
        if (!fromNode || !toNode) {
            console.warn("Selecciona dos nodos para crear un enlace.");
            return;
        }
    
        // Datos del nuevo enlace
        const newLinkData = {
            key: generatekeyEnlace2(), 
            from: fromNode.key,
            to: toNode.key, 
            startLabel: ".", // Usar valor ingresado por el usuario
            centerLabel: "...", // Usar valor ingresado por el usuario
            endLabel: ".", // Usar valor ingresado por el usuario
            namee: "New Association Class", // Usar valor ingresado por el usuario -------------
            category: linkType 
        };
    
        console.log("Nuevo enlace a añadir:", newLinkData);
    
        // Inicia una transacción para agregar el enlace
        myDiagram.startTransaction("add new link");
        myDiagram.model.addLinkData(newLinkData);
        myDiagram.commitTransaction("add new link");
        
        // Solicita una actualización del diagrama
        myDiagram.requestUpdate();
    
        console.log("Enlace añadido, revisando el modelo");
    
        // Guarda el nuevo modelo en Firebase después de añadir el enlace
        const updatedModelJson = myDiagram.model.toJson();
        updateModelData(documentIdRef.current, updatedModelJson)
          .then(() => {
              console.log("Modelo actualizado en Firebase después de añadir el enlace.");
          })
          .catch((error) => {
              console.error("Error al actualizar el modelo en Firebase:", error);
          });
    };
    

    /*const handleAddLink = () => {
        if (!fromNode || !toNode) {
            console.warn("Selecciona dos nodos para crear un enlace.");
            return;
        }
    
        const linkKey = generatekeyEnlace2(); // Generar una clave única para el enlace
    
        // Datos del nuevo enlace
        const newLinkData = {
            key: linkKey,
            from: fromNode.key,
            to: toNode.key,
            startLabel: ".", 
            centerLabel: "...",
            endLabel: ".", 
            category: linkType // Este debería ser 'Generalization', 'Dependency', 'AssociationClass', etc.
        };
    
        console.log("Nuevo enlace a añadir:", newLinkData);
    
        // Iniciar transacción para agregar el enlace
        myDiagram.startTransaction("add new link");
    
        // Añadir el enlace al modelo del diagrama
        myDiagram.model.addLinkData(newLinkData);
    
        // Si el enlace es de tipo 'AssociationClass', crea un nodo intermedio
        if (linkType === 'AssociationClass') {
            const associationClassKey = generateKey(); // Generar una clave única para la clase asociada
    
            const associationClassNode = {
                key: associationClassKey,
                loc: '0 0', // Posición inicial del nodo (puedes ajustar según sea necesario)
                properties: [], // Atributos de la clase
                methods: [], // Métodos de la clase
                isAssociationClass: true, // Etiqueta para indicar que este nodo es una 'AssociationClass'
                linkedToLink: linkKey, // Relacionar este nodo con el enlace
                name: "New Association Class" // Nombre inicial
            };
    
            console.log("Nuevo nodo 'AssociationClass' a añadir:", associationClassNode);
    
            // Añadir el nodo intermedio al modelo del diagrama
            myDiagram.model.addNodeData(associationClassNode);
        }
    
        // Finalizar la transacción
        myDiagram.commitTransaction("add new link");
    
        const updatedModelJson = JSON.stringify(myDiagram.model.toJson(), null, 2);
        setModelJson(updatedModelJson);
    };*/
    
    
    // Luego, tu función handleAddLink
    /*const handleAddLink = () => {
        if (!fromNode || !toNode) {
            console.warn("Selecciona dos nodos para crear un enlace.");
            return;
        }
    
        const linkKey = generatekeyEnlace2(); // Generar una clave única para el enlace
    
        // Datos del nuevo enlace
        const newLinkData = {
            key: linkKey,
            from: fromNode.key,
            to: toNode.key,
            startLabel: ".",
            centerLabel: "...",
            endLabel: ".",
            category: linkType // Este debería ser 'Generalization', 'Dependency', 'AssociationClass', etc.
        };
    
        console.log("Nuevo enlace a añadir:", newLinkData);
    
        // Iniciar transacción para agregar el enlace
        myDiagram.startTransaction("add new link");
    
        // Añadir el enlace al modelo del diagrama
        myDiagram.model.addLinkData(newLinkData);
    
        // Verificar si ya existe un nodo 'AssociationClass' entre estos dos nodos
        const existingAssociationNode = myDiagram.model.findNodeData(node => 
            node.isAssociationClass && 
            (node.linkedToLink === linkKey)
        );
    
        // Si el nodo no existe, créalo
        if (!existingAssociationNode) {
            const associationClassKey = generateKey(); // Generar una clave única para la clase asociada
    
            const associationClassNode = {
                key: associationClassKey,
                loc: `0 0`, // Posición media
                properties: [], // Atributos de la clase
                methods: [], // Métodos de la clase
                isAssociationClass: true, // Etiqueta para indicar que este nodo es una 'AssociationClass'
                linkedToLink: linkKey, // Relacionar este nodo con el enlace
                name: "Nueva Clase Asociación" // Nombre inicial
            };
    
            console.log("Nuevo nodo 'AssociationClass' a añadir:", associationClassNode);
    
            // Añadir el nodo intermedio al modelo del diagrama
            myDiagram.model.addNodeData(associationClassNode);
        } else {
            console.log("El nodo 'AssociationClass' ya existe entre estos nodos.");
        }
    
        // Finalizar la transacción
        myDiagram.commitTransaction("add new link");
    
        const updatedModelJson = JSON.stringify(myDiagram.model.toJson(), null, 2);
        setModelJson(updatedModelJson);
    };*/
    




    ////////////////////////////////////////////////////////////////////////////////// 
    
    // Listener para el evento 'SelectionMoved' del diagrama
    const ListenersMovimiento = (myDiagram, setModelJson) => {
        myDiagram.addDiagramListener('SelectionMoved', async (e) => {
            console.log("Evento SelectionMoved disparado");
    
            const movedParts = e.subject;
    
            if (movedParts instanceof go.Set) {
                await Promise.all(movedParts.map(async (part) => {
                    if (part instanceof go.Part) {
                        //console.log("Parte movida:", part);
    
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

    // Listener para capturar cambios en los nodos
    const ListenerAddNodeEdit = () => {
        if (!myDiagram) return; // Verifica que el diagrama esté inicializado
    
        myDiagram.addDiagramListener("TextEdited", async (e) => {
            const editedPart = e.subject.part; // Obtiene la parte editada
            if (editedPart instanceof go.Node) {
                const nodeData = editedPart.data; // Accede a los datos del nodo
    
                // Actualiza los datos del nodo basado en las ediciones
                const updatedNodeData = {
                    ...nodeData,
                    // Aquí podrías agregar lógica para actualizar `name`, `properties`, y `methods` si es necesario
                };
    
                // Ejemplo: Supongamos que tienes un TextBlock para el nombre
                const nameTextBlock = editedPart.findObject("nameTextBlock"); // Cambia "nameTextBlock" por el nombre real
                if (nameTextBlock) {
                    updatedNodeData.name = nameTextBlock.text; // Actualiza el nombre
                }
    
                // Suponiendo que tienes una manera de acceder a las propiedades y métodos editables:
                const propertiesTextBlock = editedPart.findObject("propertiesTextBlock"); // Cambia según tu implementación
                if (propertiesTextBlock) {
                    updatedNodeData.properties = propertiesTextBlock.text.split(',').map(prop => prop.trim()); // Divide por comas
                }
    
                const methodsTextBlock = editedPart.findObject("methodsTextBlock"); // Cambia según tu implementación
                if (methodsTextBlock) {
                    updatedNodeData.methods = methodsTextBlock.text.split(',').map(method => method.trim()); // Divide por comas
                }
    
                // Actualiza el modelo con los nuevos datos
                myDiagram.model.setDataProperty(nodeData, 'name', updatedNodeData.name);
                myDiagram.model.setDataProperty(nodeData, 'properties', updatedNodeData.properties);
                myDiagram.model.setDataProperty(nodeData, 'methods', updatedNodeData.methods);
                myDiagram.model.updateTargetBindings(nodeData); // Asegúrate de que el modelo está actualizado
    
                console.log("Nodo actualizado:", updatedNodeData); // Para depuración
    
                // Actualiza el modelo JSON para Firestore
                const updatedModelJson = myDiagram.model.toJson(); // Obtiene la representación actualizada del modelo
    
                // Actualiza Firestore con el modelo modificado
                try {
                    await updateModelData(documentIdRef.current, updatedModelJson);
                    console.log("Modelo actualizado en Firestore.");
                } catch (error) {
                    console.error("Error al actualizar Firestore:", error);
                }
            }
        });
    };
    
    // Listener para capturar cambios en los enlaces
    /*function handleLinkSelection(myDiagram, documentId) {
        myDiagram.addDiagramListener("ChangedSelection", (e) => {
            const link = e.subject.first(); // Obtén el primer enlace seleccionado
            if (link instanceof go.Link) {
                console.log("Enlace seleccionado:", link.data);
    
                const updatedModelJson = myDiagram.model.toJson();
                console.log("Modelo actualizado tras seleccionar un enlace:", updatedModelJson);
                
                // Llama a tu función de actualización de Firebase aquí
                updateModelData(documentId, updatedModelJson);
            }
        });
    }*/
    

    function handleLinkSelection(myDiagram, documentId) {
        let previousModelJson = myDiagram.model.toJson(); // Almacena el modelo inicial
    
        myDiagram.addDiagramListener("ChangedSelection", (e) => {
            const link = e.subject.first(); // Obtén el primer enlace seleccionado
            if (link instanceof go.Link) {
                console.log("Enlace seleccionado:", link.data);
        
                const updatedModelJson = myDiagram.model.toJson();
                console.log("Modelo actualizado tras seleccionar un enlace:", updatedModelJson);
                
                // Solo actualiza si el modelo ha cambiado
                if (updatedModelJson !== previousModelJson) {
                    updateModelData(documentId, updatedModelJson); // Actualiza Firebase
                    previousModelJson = updatedModelJson; // Actualiza el modelo anterior
                }
            }
        });
    }

    // Listener para capturar cambios en los enlaces
    function handleTextEdited(myDiagram, documentId) {
        myDiagram.addDiagramListener("TextEdited", (e) => {
            const editedPart = e.subject.part; // Obtén la parte editada
            if (editedPart instanceof go.Link) {
                const linkData = editedPart.data; // Accede a los datos del enlace
    
                // Extraer manualmente los textos editados
                const startLabel = linkData.startLabel;
                const centerLabel = linkData.centerLabel;
                const endLabel = linkData.endLabel;
    
                console.log("Texto del enlace editado:", { startLabel, centerLabel, endLabel });
    
                // Actualizar Firebase con el modelo modificado
                const updatedModelJson = myDiagram.model.toJson();
                updateModelData(documentId, updatedModelJson);
            }
        });
    }
    



    const ListenersEnlaces = (myDiagram, setModelJson) => {
        // Listener para enlaces dibujados o actualizados
        myDiagram.addDiagramListener('LinkDrawn', (e) => {
            const link = e.subject;
            if (link) {
                const linkData = link.data;
        
                console.log("Nuevo enlace dibujado:", JSON.stringify(linkData, null, 2));
        
                // Actualiza el modelo tras crear el enlace
                const updatedModelJson = myDiagram.model.toJson();
                console.log("Modelo actualizado tras crear enlace:", updatedModelJson);
        
                // Actualiza Firestore o el estado local
                if (documentIdRef.current) {
                    updateModelData(documentIdRef.current, updatedModelJson);
                }
                setModelJson(updatedModelJson);
            }
        });
        
        // Listener para enlaces reubicados (relinked)
        myDiagram.addDiagramListener('LinkRelinked', (e) => {
            const link = e.subject;
            if (link) {
                const linkData = link.data;
        
                console.log("Enlace reubicado o relinked:", JSON.stringify(linkData, null, 2));
        
                // Actualiza el modelo tras el relink
                const updatedModelJson = myDiagram.model.toJson();
                console.log("Modelo actualizado tras relink:", updatedModelJson);
        
                if (documentIdRef.current) {
                    updateModelData(documentIdRef.current, updatedModelJson);
                }
                setModelJson(updatedModelJson);
            }
        });
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

    // Anadir listener para los enlaces
    const ListenersEnlaces2 = (myDiagram) => {
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
            const editedTextBlock = e.subject; // El TextBlock editado
            const part = editedTextBlock.part;   // Parte a la que pertenece el TextBlock
            
            if (part instanceof go.Node) {
                // Actualizar datos del nodo en Firestore
                const nodeData = part.data; // Obtener los datos del nodo
                const nodeRef = doc(db, 'nodos', nodeData.key); // Referencia al documento en Firestore
    
                try {
                    await updateDoc(nodeRef, {
                        text: nodeData.text, // Guarda el texto del nodo
                        properties: nodeData.properties || [], // Si tienes propiedades, también las guarda
                        methods: nodeData.methods || [] // Si tienes métodos, también los guarda
                    });
                    console.log("Nodo actualizado:", JSON.stringify(nodeData, null, 2));
                } catch (error) {
                    console.error("Error updating node:", error);
                }
            } else if (part instanceof go.Link) {
                // Actualizar datos del enlace en Firestore
                const linkData = part.data; // Obtener los datos del enlace
                const linkRef = doc(db, 'links', linkData.key); // Referencia al documento en Firestore
    
                try {
                    // Aquí obtenemos el texto actualizado directamente del TextBlock editado
                    const startLabel = part.findObject("startLabel").text; // Obteniendo el texto de la etiqueta de inicio
                    const centerLabel = part.findObject("centerLabel").text; // Obteniendo el texto de la etiqueta central
                    const endLabel = part.findObject("endLabel").text; // Obteniendo el texto de la etiqueta final
    
                    // Actualizar las etiquetas del enlace
                    await updateDoc(linkRef, {
                        startLabel: startLabel || 'defaultStartLabel', // Usa el valor por defecto si no hay
                        centerLabel: centerLabel || 'defaultCenterLabel', // Usa el valor por defecto si no hay
                        endLabel: endLabel || 'defaultEndLabel' // Usa el valor por defecto si no hay
                    });
                    console.log("Enlace actualizado:", JSON.stringify(linkData, null, 2));
                } catch (error) {
                    console.error("Error updating link:", error);
                }
            }
        });
    };
    

    
    ////////////////////////////////////////////////////////////////////////////////

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
                //console.log("Datos obtenidos de Firestore:", data);
    
                // Analizar la cadena JSON en un objeto
                const modelData = JSON.parse(data.modelData);
    
                if (modelData.nodeDataArray && modelData.nodeDataArray.length > 0 || modelData.linkDataArray && modelData.linkDataArray.length > 0) {
                    if (myDiagram) {
                        // Actualizar el modelo del diagrama con los datos obtenidos
                        myDiagram.model = go.Model.fromJson(modelData);
    
                        // Reasignar las posiciones manualmente después de establecer el modelo
                        modelData.nodeDataArray.forEach((node) => {
                            const part = myDiagram.findPartForData(node);
                            if (part) {
                                const newLoc = go.Point.parse(node.loc); 
                                part.position = newLoc; 
                            }
                        });


                        // Mostrar información de enlaces cargados
                    /*modelData.linkDataArray.forEach(link => {
                        console.log(`Link cargado: ${link.key} - Categoría: ${link.category}`);
                    });*/

                        setNodes(modelData.nodeDataArray);
    
                        // Forzar la actualización del diagrama
                        myDiagram.updateAllTargetBindings();
                        myDiagram.requestUpdate();
    
                        setModelJson(modelData);
                        if (modelData.linkDataArray && modelData.linkDataArray.length > 0) {
                            console.log("Links encontradooooooooos:", modelData.linkDataArray);
                        }
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

    // Función para suscribirse a los cambios del modelData en Firestore en tiempo real
    const subscribeToModelData = (documentId) => {
        try {
            if (!db) throw new Error("Firestore DB no está inicializado.");
            if (!documentId) throw new Error("documentId es indefinido o nulo.");

            const docRef = doc(db, "diagramas", documentId);

            // Suscripción en tiempo real a los cambios del documento
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    console.log("Datos obtenidos en tiempo real de Firestore:", data);

                    // Analizar la cadena JSON en un objeto
                    const modelData = JSON.parse(data.modelData);

                    if ((modelData.nodeDataArray && modelData.nodeDataArray.length > 0) || 
                        (modelData.linkDataArray && modelData.linkDataArray.length > 0)) {

                        if (myDiagram) {
                            // Actualizar el modelo del diagrama con los datos obtenidos
                            myDiagram.model = go.Model.fromJson(modelData);

                            // Reasignar las posiciones manualmente después de establecer el modelo
                            modelData.nodeDataArray.forEach((node) => {
                                const part = myDiagram.findPartForData(node);
                                if (part) {
                                    const newLoc = go.Point.parse(node.loc);
                                    part.position = newLoc;
                                }
                            });

                            setNodes(modelData.nodeDataArray);

                            // Forzar la actualización del diagrama
                            myDiagram.updateAllTargetBindings();
                            myDiagram.requestUpdate();

                            setModelJson(modelData);

                            if (modelData.linkDataArray && modelData.linkDataArray.length > 0) {
                                console.log("Enlaces encontrados:", modelData.linkDataArray);
                            }

                            console.log("Model data actualizado en tiempo real:", modelData);
                        } else {
                            console.error("myDiagram no está definido.");
                        }
                    } else {
                        console.warn("El campo modelData está vacío o es inválido.");
                    }
                } else {
                    console.error("No se encontró el documento.");
                }
            });
            

            return unsubscribe; // Devuelve la función de cancelación de suscripción
        } catch (error) {
            console.error("Error suscribiéndose a modelData:", error.message || error);
        }
    };

   

    ///////////////////////////////////////////////////////////////////////////////////
    
    





    /////////////////////////////////////////////////////////////////////////////////////
          

    function nuevoDiagrama() {
        myDiagram.model = new go.GraphLinksModel();
    }

    function importarArchivo() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt'; // Aceptar archivos .json
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

    function descargarArchivoTXT() {
        if (myDiagram && myDiagram.nodes) {
            const nodeDataArray = [];
    
            myDiagram.nodes.each(node => {
                if (node instanceof go.Node) {
                    const key = node.data.key || "";
                    const name = node.data.name || "sin_nombre";
                    const properties = node.data.properties || [];
                    const methods = node.data.methods || [];
                    
                    // Obtener la ubicación actual desde la propiedad position del nodo
                    const loc = go.Point.stringify(node.position) || "0 0";
    
                    nodeDataArray.push({
                        key: key,
                        loc: loc,              
                        properties: properties,
                        methods: methods,
                        name: name
                    });
                }
            });
    
            // Estructurar los datos finales en el formato requerido
            const data = {
                "class": "_GraphLinksModel",
                "linkKeyProperty": "key",  
                "nodeDataArray": nodeDataArray,  
                "linkDataArray": myDiagram.model.linkDataArray || []  
            };

            const text = JSON.stringify(data, null, 2); // Convertir los datos a formato JSON
    
            // Crear el archivo y descargarlo
            const blob = new Blob([text], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
    
            // Crear un enlace temporal para la descarga
            const link = document.createElement('a');
            link.href = url;
            link.download = 'diagrama.txt'; 
            link.click();
        } else {
            console.error('El modelo o nodeDataArray no está disponible.');
        }
    } 

    function descargarArchivoJSON() {
        const text = myDiagram.model.toJson();
        const blob = new Blob([text], { type: 'application/json' });// Crea un Blob con el JSON y el tipo MIME adecuado
        const url = window.URL.createObjectURL(blob); // Crea una URL para el Blob
        // Crea un enlace temporal para descargar el archivo
        const link = document.createElement('a');
        link.href = url;
        link.download = 'diagrama.json'; // Nombre del archivo JSON
        link.click();// Simula un clic en el enlace para iniciar la descarga
        window.URL.revokeObjectURL(url);// Limpia el enlace temporal
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

    function descargarArchivoXMI() {
        const json = JSON.parse(myDiagram.model.toJson());
    
        // Crear la estructura básica del XMI
        let xmi = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmi += '<XMI xmi.version="2.1" xmlns:uml="http://www.omg.org/spec/UML/20090901" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1">\n';
        xmi += '  <uml:Model name="GoJSModel" xmi:id="model1">\n';
    
        // Convertir nodos GoJS a clases UML
        json.nodeDataArray.forEach(node => {
            // Añadir la clase
            xmi += `    <packagedElement xmi:type="uml:Class" xmi:id="${node.key}" name="${node.name}">\n`;
    
            // Añadir propiedades
            if (node.properties && Array.isArray(node.properties) && node.properties.length > 0) {
                node.properties.forEach(property => {
                    const visibility = property.visibility || "public"; // Default visibility
                    const type = property.type || "String"; // Default type
                    xmi += `      <ownedAttribute xmi:id="${node.key}_${property.name}" name="${property.name}" visibility="${visibility}">\n`;
                    xmi += `        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20090901/PrimitiveTypes.xml#${type}"/>\n`;
                    xmi += '      </ownedAttribute>\n';
                });
            }
    
            // Añadir métodos
            if (node.methods && Array.isArray(node.methods) && node.methods.length > 0) {
                node.methods.forEach(method => {
                    const visibility = method.visibility || "private"; // Default visibility
                    const returnType = method.type || "void"; // Default return type
    
                    xmi += `      <ownedOperation xmi:id="${node.key}_${method.name}" name="${method.name}" visibility="${visibility}">\n`;
    
                    // Añadir parámetros
                    if (method.parameters && Array.isArray(method.parameters) && method.parameters.length > 0) {
                        method.parameters.forEach(param => {
                            xmi += `        <ownedParameter xmi:id="${node.key}_${method.name}_${param.name}" name="${param.name}" direction="in">\n`;
                            xmi += `          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20090901/PrimitiveTypes.xml#${param.type || 'String'}"/>\n`;
                            xmi += '        </ownedParameter>\n';
                        });
                    }
    
                    // Añadir tipo de retorno
                    xmi += `        <ownedParameter xmi:id="${node.key}_${method.name}_return" direction="return" name="return">\n`;
                    xmi += `          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20090901/PrimitiveTypes.xml#${returnType}"/>\n`;
                    xmi += '        </ownedParameter>\n';
                    xmi += '      </ownedOperation>\n';
                });
            }
    
            xmi += '    </packagedElement>\n';
        });
    
        const crearEnlaceXMI = (link, fromNode, toNode) => {
            let enlaceXMI = '';
            
            switch (link.category) {
                case 'Association':
                case 'Aggregation':
                case 'Composition': {
                    let aggregationType = '';
                    if (link.category === 'Aggregation') {
                        aggregationType = 'shared'; // Agregación
                    } else if (link.category === 'Composition') {
                        aggregationType = 'composite'; // Composición
                    }

                    // Asociación estándar, composición o agregación
                    enlaceXMI = `    <packagedElement xmi:type="uml:Association" xmi:id="${link.key}" name="${link.centerLabel || 'Association_' + link.key}">\n`;
                    enlaceXMI += `      <memberEnd xmi:idref="${link.key}_from"/>\n`;
                    enlaceXMI += `      <memberEnd xmi:idref="${link.key}_to"/>\n`;

                    // Definir el extremo del fromNode  sin agregación o composición
                    enlaceXMI += `      <ownedEnd xmi:id="${link.key}_from" type="${fromNode.key}" visibility="public" navigable="true" >\n`;
                    enlaceXMI += `        <role name="${link.startLabel || ''}"/>\n`;
                    enlaceXMI += `        <type xmi:type="uml:Class" href="#${fromNode.key}"/>\n`;
                    enlaceXMI += '      </ownedEnd>\n';

                    // Definir el extremo del toNode con agregación o composición
                    enlaceXMI += `      <ownedEnd xmi:id="${link.key}_to" type="${toNode.key}" visibility="public" navigable="true" ${aggregationType ? `aggregation="${aggregationType}"` : ''}>\n`;
                    enlaceXMI += `        <role name="${link.endLabel || ''}"/>\n`;
                    enlaceXMI += `        <type xmi:type="uml:Class" href="#${toNode.key}"/>\n`;
                    enlaceXMI += '      </ownedEnd>\n';

                    enlaceXMI += '    </packagedElement>\n';
                    break;
                }

        
               /* case 'Generalization': {
                    // Relación de herencia
                    enlaceXMI = `    <packagedElement xmi:type="uml:Generalization" xmi:id="${link.key}" general="${fromNode.key}" specific="${toNode.key}"/>\n`;
                    break;
                }*/

                case 'Generalization': {       fromNode.key
                    // Relación de herencia (Generalization) anidada dentro de la clase "specific" (toNode)
                    enlaceXMI = `    <packagedElement xmi:type="uml:Class" xmi:id="${fromNode.key}" name="${fromNode.key}">\n`;
                    enlaceXMI += `      <generalization xmi:id="${link.key}" general="${toNode.key}"/>\n`;
                    enlaceXMI += '    </packagedElement>\n';
                    break;
                }
                        
        
                case 'Realization': {
                    // Relación de realización (una clase realiza una interfaz)
                    enlaceXMI = `    <packagedElement xmi:type="uml:Realization" xmi:id="${link.key}" client="${fromNode.key}" supplier="${toNode.key}"/>\n`;
                    break;
                }
        
                case 'Dependency': {
                    // Relación de dependencia
                    enlaceXMI = `    <packagedElement xmi:type="uml:Dependency" xmi:id="${link.key}" client="${fromNode.key}" supplier="${toNode.key}"/>\n`;
                    break;
                }
        
  

                case 'AssociationClass': {
                    // Relación de clase de asociación
                    enlaceXMI = `    <packagedElement xmi:type="uml:AssociationClass" xmi:id="${link.key}" name="${link.namee || 'AssociationClass_' + link.key}">\n`;
                
                    // Definir los extremos (memberEnd y ownedEnd)
                    enlaceXMI += `      <memberEnd xmi:idref="${link.key}_from"/>\n`;
                    enlaceXMI += `      <memberEnd xmi:idref="${link.key}_to"/>\n`;
                
                    enlaceXMI += `      <ownedEnd xmi:id="${link.key}_from" type="${fromNode.key}" visibility="public" navigable="true">\n`;
                    enlaceXMI += `        <role name="${link.startLabel || ''}"/>\n`;
                    enlaceXMI += `        <type xmi:type="uml:Class" href="#${fromNode.key}"/>\n`;
                    enlaceXMI += '      </ownedEnd>\n';
                
                    enlaceXMI += `      <ownedEnd xmi:id="${link.key}_to" type="${toNode.key}" visibility="public" navigable="true">\n`;
                    enlaceXMI += `        <role name="${link.endLabel || ''}"/>\n`;
                    enlaceXMI += `        <type xmi:type="uml:Class" href="#${toNode.key}"/>\n`;
                    enlaceXMI += '      </ownedEnd>\n';

                    //enlaceXMI += `        <centerLabel name="${link.centerLabel || ' '}"/>\n`;
                
                    // Añadir propiedades para la AssociationClass
                    if (link.properties && Array.isArray(link.properties) && link.properties.length > 0) {
                        link.properties.forEach(property => {
                            const visibility = property.visibility || "public"; // Default visibility
                            const type = property.type || "String"; // Default type
                            enlaceXMI += `      <ownedAttribute xmi:id="${link.key}_${property.name}" name="${property.name}" visibility="${visibility}">\n`;
                            enlaceXMI += `        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20090901/PrimitiveTypes.xml#${type}"/>\n`;
                            enlaceXMI += '      </ownedAttribute>\n';
                        });
                    }
                
                    // Añadir métodos para la AssociationClass
                    if (link.methods && Array.isArray(link.methods) && link.methods.length > 0) {
                        link.methods.forEach(method => {
                            const visibility = method.visibility || "private"; // Default visibility
                            const returnType = method.type || "void"; // Default return type
                
                            enlaceXMI += `      <ownedOperation xmi:id="${link.key}_${method.name}" name="${method.name}" visibility="${visibility}">\n`;
                
                            // Añadir parámetros
                            if (method.parameters && Array.isArray(method.parameters) && method.parameters.length > 0) {
                                method.parameters.forEach(param => {
                                    enlaceXMI += `        <ownedParameter xmi:id="${link.key}_${method.name}_${param.name}" name="${param.name}" direction="in">\n`;
                                    enlaceXMI += `          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20090901/PrimitiveTypes.xml#${param.type || 'String'}"/>\n`;
                                    enlaceXMI += '        </ownedParameter>\n';
                                });
                            }
                
                            // Añadir tipo de retorno
                            enlaceXMI += `        <ownedParameter xmi:id="${link.key}_${method.name}_return" direction="return" name="return">\n`;
                            enlaceXMI += `          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20090901/PrimitiveTypes.xml#${returnType}"/>\n`;
                            enlaceXMI += '        </ownedParameter>\n';
                            enlaceXMI += '      </ownedOperation>\n';
                        });
                    }
                
                    enlaceXMI += '    </packagedElement>\n';
                    break;
                }
                                            
                default: {
                    console.warn(`Tipo de enlace desconocido: ${link.category}`);
                    break;
                }
            }
        
            return enlaceXMI;
        };
        
        
        // Añadir enlaces (asociaciones)
        if (json.linkDataArray && Array.isArray(json.linkDataArray)) {
            json.linkDataArray.forEach(link => {
                const fromNode = json.nodeDataArray.find(node => node.key === link.from);
                const toNode = json.nodeDataArray.find(node => node.key === link.to);
    
                if (fromNode && toNode) {
                    xmi += crearEnlaceXMI(link, fromNode, toNode);
                } else {
                    console.warn(`Enlace ${link.key} tiene nodos inválidos: from=${link.from}, to=${link.to}`);
                }
            });
        }
    
        xmi += '  </uml:Model>\n';
        xmi += '</XMI>';
    
        // Crear un Blob con el XMI y el tipo MIME adecuado
        const blob = new Blob([xmi], { type: 'application/xml' });
    
        // Crear una URL para el Blob
        const url = window.URL.createObjectURL(blob);
    
        // Crear un enlace temporal para descargar el archivo
        const link = document.createElement('a');
        link.href = url;
        link.download = 'diagrama.xmi'; // Nombre del archivo XMI
        link.click(); // Simula un clic en el enlace para iniciar la descarga
    
        // Limpia el enlace temporal
        window.URL.revokeObjectURL(url);
    }


    

    if (!modelJson) {return <div>Loading...</div>; }

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
                    {/*<Button id="SaveButton" className="botones_navbar_button" onClick={() => save(diagramaId)}>Guardar</Button> */}
                    <Button className="botones_navbar_button" onClick={descargarArchivoTXT}>Descargar</Button>
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
                            

                        {/* Selector para elegir el nodo de origen */}
                        <select onChange={(e) => {
                            const selectedNode = nodes.find(node => node.key.toString() === e.target.value); 
                            console.log("Nodo de origen seleccionado:", selectedNode);
                            setFromNode(selectedNode);
                        }}>
                            <option value="">Clase de origen</option>
                            {nodes.map(node => ( <option key={node.key} value={node.key}>{node.name}</option> ))}
                        </select>

                        {/* Selector para elegir el nodo de destino */}
                        <select onChange={(e) => {
                            const selectedNode = nodes.find(node => node.key.toString() === e.target.value); 
                            console.log("Nodo de destino seleccionado:", selectedNode);
                            setToNode(selectedNode);
                        }}>
                            <option value="">Clase de destino</option>
                            {nodes.map(node => ( <option key={node.key} value={node.key}>{node.name}</option> ))}
                        </select>

                        {/* Selector para elegir el tipo de enlace */}
                        <select
                            value={linkType}
                            onChange={(e) => {
                                console.log("Tipo de enlace seleccionado:", e.target.value); 
                                setLinkType(e.target.value); // Actualiza el tipo de enlace
                            }}>
                            <option value="">Elegir Relacion</option>    
                            <option value="Association">Asociación</option>
                            <option value="Generalization">Generalización</option>
                            <option value="Composition">Composición</option>
                            <option value="Aggregation">Agregacion</option>
                            <option value="AssociationClass">clase Intermedia</option>
                            <option value="Realization">Realización</option>
                            <option value="Dependency">Dependencia</option>
                        </select>
                        <Button className="btn" onClick={handleAddLink} style={{ width: '150px', margin: '5px' }}  disabled={ !linkType || !fromNode || !toNode}>Añadir Enlace</Button><br />
                       

                        {/* <Button onClick={() => saveDiagram(diagramaId, myDiagram.model.toJson())}>Guardar Diagramaaa</Button>*/}
                    </div>


                    <div>
                        <p><strong>EXPORTAR A:</strong></p>
                        <Button className="btn" onClick={descargarArchivoXMI} style={{ width: '120px', margin: '5px' }}>Formato XMI</Button><br />
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