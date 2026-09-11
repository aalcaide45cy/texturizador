# Texturizador 3D

Una herramienta web avanzada y de alto rendimiento para aplicar texturas de relieve y mapas de desplazamiento a modelos 3D directamente desde el navegador, sin necesidad de instalación y con procesamiento 100% local.

Carga un archivo STL, OBJ, 3MF o STEP, elige una textura, ajusta los parámetros de proyección y relieve, y exporta tu nuevo modelo 3D listo para laminar e imprimir en 3D.

---

## Características Principales

### 🎨 Texturas y Relieves
- **24 texturas integradas**: cestería, ladrillo, burbujas, fibra de carbono, cristal, puntos, cuadrícula, superficie de agarre, hexágonos, isogrid, punto de tejer, moleteado (knurling), cuero, ruido procedural, rayas, voronoi, tejidos y maderas.
- **Texturas personalizadas**: sube cualquier imagen (PNG, JPG) para usarla como mapa de desplazamiento.
- **Suavizado de texturas**: desenfoque configurable para suavizar transiciones en el mapa de desplazamiento.

### 📐 Modos de Proyección
- **Triplanar**: mezcla suavemente tres proyecciones ortogonales según la orientación de las normales de la superficie; ideal para formas orgánicas y complejas.
- **Cúbica (Box)**: proyecta desde las 6 caras de una caja envolvente con suavizado inteligente de juntas.
- **Cilíndrica**: envuelve la textura radialmente alrededor del objeto con umbral de ángulo de tapa ajustable.
- **Esférica**: mapeado esférico completo.
- **Planar (XY / XZ / YZ)**: proyección plana alineada con los ejes.

### 🎛️ Control de Transformación y UV
- **Escala U / V**: ajuste independiente o proporcional (0.05× a 10×).
- **Desplazamiento (Offset U/V)** y **Rotación**.
- **Amplitud**: control de profundidad de desplazamiento de 0% a 100%.
- **Desplazamiento simétrico**: conserva el volumen de la pieza (el gris 50% permanece neutral, el blanco empuja hacia afuera y el negro hacia adentro).
- **Previsualización 3D en tiempo real**: previsualización acelerada por GPU de la malla deformada antes de hornear.

### 🖌️ Enmascarado y Selección de Superficies
- **Filtro por ángulo**: excluye o limita la textura en caras horizontales superiores o inferiores (útil para mantener planas las bases de impresión).
- **Pintura de caras**:
  - Pincel de tamaño regulable para pintar caras a incluir o excluir.
  - Herramienta de relleno (bote de pintura) por umbral de ángulo diédrico.

### ⚙️ Procesamiento de Malla de Alto Rendimiento
- **Subdivisión adaptativa**: subdivide aristas hasta alcanzar la resolución objetivo preservando bordes afilados.
- **Decimación QEM**: optimiza y reduce el recuento final de triángulos mediante métricas de error cuadrático manteniendo la fidelidad geométrica.
- **Web Workers multihilo**: los procesos intensivos de cálculo no bloquean la interfaz de usuario.

### 📁 Formatos Compatibles
- **Importación**: `.stl` (binario y ASCII), `.obj`, `.3mf`, `.step` / `.stp` (tessellation CAD directa en navegador).
- **Exportación**: `.stl` binario y `.3mf`.
- **Proyectos**: Guarda y recupera proyectos completos con extensión `.texturizador`.

---

## 🚀 Despliegue en Vercel

Esta aplicación es una aplicación web estática pura (HTML5, CSS3, JavaScript ES Modules, WebGL con Three.js y Web Workers). No requiere servidor Node.js backend ni base de datos.

### Pasos para desplegar en Vercel:

1. Ve a tu panel de control en [Vercel](https://vercel.com/).
2. Haz clic en **"Add New..."** → **"Project"**.
3. Conecta e importa este repositorio: tu repositorio privado.
4. En la configuración del proyecto:
   - **Framework Preset**: Selecciona `Other` (o deja en blanco).
   - **Root Directory**: `./`
   - **Build Command**: Ninguno (dejar vacío).
   - **Output Directory**: Ninguno (dejar vacío).
5. Haz clic en **"Deploy"**.
6. ¡Listo! Vercel desplegará la aplicación en segundos en una URL global de alta velocidad.

---

## 💻 Ejecución Local

Para probar la aplicación en tu propio ordenador:

Debido a que los navegadores bloquean las importaciones de módulos ES y los Web Workers cuando se cargan mediante el protocolo `file://`, necesitas iniciar un servidor HTTP local básico:

### Con Node.js (npx):
```bash
npx serve .
```

### Con Python:
```bash
python -m http.server 8000
```

Abre tu navegador en `http://localhost:8000` o `http://localhost:3000`.

---

## 🔒 Privacidad

Todo el procesamiento geométrico y de texturas se ejecuta de forma **100% local en tu navegador**. Ningún archivo, modelo 3D o imagen se transfiere a ningún servidor externo.
