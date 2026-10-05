import { useState } from "react";
import "./App.css";
import axios from "axios";

function App() {
  const [estado, setEstado] = useState("inactivo");
  const [nombreApi, setNombreApi] = useState("");

  const comprobarConexion = async () => {
    setEstado("cargando");

    try {
      const respuesta = await axios.get("http://localhost:3000/health");

      setNombreApi(respuesta.data.app);
      setEstado("exito");
    } catch {
      setEstado("error");
    }
  };

  return (
    <>
      <button onClick={comprobarConexion} disabled={estado === "cargando"}>
        Comprobar conexión
      </button>

      {estado === "cargando" && <p>Comprobando..</p>}
      {estado === "exito" && <p>{nombreApi}</p>}
      {estado === "error" && <p>No se pudo conectar</p>}
    </>
  );
}

export default App;
