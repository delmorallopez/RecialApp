
// Copyright 2021 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { Component } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import imageAddRouteMain from './Images/imageAddRouteMain.jpg';

const defaultMapOptions = {
    tilt: 0,
    center: {
        lat: 51.523079,
        lng: -0.136470
    },
    zoom: 18,
    heading: 0,
    mapId: "fb1fb4f474a60be6"
};

const apiOptions = {
    "apiKey": "AIzaSyBV-nAoEPH5OItd12aVWcj1URCI5poWl10",
    "version": "beta",
    //libraries: ["places"]
};

const loader = new Loader(apiOptions);


// async function initMap() {    
//   const mapDiv = document.getElementById("map");
//   const apiLoader = new Loader(apiOptions);
//   await apiLoader.load()      
//   return new google.maps.Map(mapDiv, defaultMapOptions);
// }

async function initWebGLOverlayView(map, google) {
    let scene, renderer, camera, loader;
    // WebGLOverlayView code goes here

    const webGLOverlayView = new google.maps.WebGLOverlayView(); //create a instant to overlay

    //Implement the lifecycle hooks
    webGLOverlayView.onAdd = () => {
        //create a three.js scene
        scene = new THREE.Scene();
        // Add camera to scene
        camera = new THREE.PerspectiveCamera();

        // Add the light sources to the scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
        directionalLight.position.set(0.5, -1, 0.5);
        scene.add(directionalLight);

        //Create a model loader instance
        loader = new GLTFLoader();

        //load a 3D model
        const source = "pin.gltf";

        loader.load(
            source,
            gltf => {

                gltf.scene.scale.set(25, 25, 25);
                gltf.scene.rotation.x = 180 * Math.PI / 180;
                scene.add(gltf.scene);
                //Create an animation loop
                renderer.setAnimationLoop(() => { });
            }
        );
    };

    webGLOverlayView.onContextRestored = ({ gl }) => {
        //To configure the renderer
        renderer = new THREE.WebGL1Renderer({
            canvas: gl.canvas,
            context: gl,
            ...gl.getContextAttributes(),
        });

        // TODO: renamed render to renderer
        renderer.autoClear = false;

        //wait for the model to load
        loader.manager.onLoad = () => {
            map.moveCamera({
                "tilt": defaultMapOptions.tilt,
                "heading": defaultMapOptions.heading,
                "zoom": defaultMapOptions.zoom
            });

            if (defaultMapOptions.tilt < 67.5) {
                defaultMapOptions.tilt += 0.5
            } else if (defaultMapOptions.heading <= 360) {
                defaultMapOptions.heading += 0.2;
            } else {
                renderer.setAnimationLoop(null)
            }
        }
    };

    webGLOverlayView.onDraw = ({ gl, transformer }) => {
        //render the scene,redraw is needed when the next frame renders
        webGLOverlayView.requestRedraw();
        renderer.render(scene, camera);
        renderer.resetState();

        //set camera projection matrix
        const latLngAltitudeLiteral = {
            lat: defaultMapOptions.center.lat,
            lng: defaultMapOptions.center.lng,
            altitude: 120
        }

        const matrix = transformer.fromLatLngAltitude(latLngAltitudeLiteral);
        camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    };

    webGLOverlayView.setMap(map);  //Add overlay instance to the map
}

// (async () => {        
//   const map = await initMap();
//   initWebGLOverlayView(map);  //call initWebOverlayView
// })();



export default class Map extends Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    async componentDidMount() {
        let self = this;

        const google = await loader.load();

        const map = new google.maps.Map(
            self.googleMapDiv,
            defaultMapOptions
        );

        await initWebGLOverlayView(map, google);

        /*
            store them in the state so you can use it later
            E.g. call a function on the map object:
                this.state.map.panTo(...)
            E.g. create a new marker:
                new this.state.google.maps.Marker(...)
        */
        this.setState({
            google: google,
            map: map
        });
    }

    render() {
        return (
            <>
                <div
                    
                    ref={(ref) => { this.googleMapDiv = ref }}
                    style={{ height: '100vh', width: '100%' }}>
                    
                    
                </div>

           </>  
        )
    }
}