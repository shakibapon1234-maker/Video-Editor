package com.wingsfly.videoeditor;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int RECORD_AUDIO_PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // The web app uses getUserMedia() / SpeechRecognition for "Record
        // Voiceover" and "Auto Subtitle / Voice Dub Mode". Those calls inside
        // the WebView are granted automatically once this native RECORD_AUDIO
        // permission is granted at runtime -- without this, every mic request
        // from the page fails silently (no crash, no error dialog, it just
        // never connects). Request it up front so it's already granted by the
        // time the user taps any mic-related button.
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    RECORD_AUDIO_PERMISSION_REQUEST_CODE
            );
        }
    }
}
