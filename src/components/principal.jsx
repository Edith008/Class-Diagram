import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button"

export default function Principal() {
    return (
      <div className="pagina_principal" >
        <Link to="/login"><Button className="boton_principal">Iniciar Sesión</Button></Link>
        <Link to="/register"><Button className="boton_principal">Registrarse</Button></Link>
      </div>
    )
} 