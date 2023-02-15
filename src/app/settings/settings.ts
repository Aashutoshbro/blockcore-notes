import { Component, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatAccordion } from '@angular/material/expansion';
import { Relay } from 'nostr-tools';
import { ApplicationState } from '../services/applicationstate';
import { StorageService } from '../services/storage';
import { EventService } from '../services/event';
import { NostrRelay } from '../services/interfaces';
import { ProfileService } from '../services/profile';
import { RelayService } from '../services/relay';
import { ThemeService } from '../services/theme';
import { AddRelayDialog, AddRelayDialogData } from '../shared/add-relay-dialog/add-relay-dialog';
import { OptionsService } from '../services/options';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DataService } from '../services/data';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrls: ['./settings.css'],
})
export class SettingsComponent {
  @ViewChild(MatAccordion) accordion!: MatAccordion;

  wiped = false;
  wipedNonFollow = false;
  wipedNotes = false;
  open = false;

  constructor(
    public optionsService: OptionsService,
    public relayService: RelayService,
    public dialog: MatDialog,
    public appState: ApplicationState,
    private profileService: ProfileService,
    public theme: ThemeService,
    private db: StorageService,
    private snackBar: MatSnackBar,
    public dataService: DataService
  ) {}

  toggle() {
    if (this.open) {
      this.open = false;
      this.accordion.closeAll();
    } else {
      this.open = true;
      this.accordion.openAll();
    }
  }

  async primaryRelay(relay: NostrRelay) {
    this.optionsService.values.primaryRelay = relay.url;
    this.optionsService.save();
  }

  // async deleteRelay(relay: Relay) {
  //   await this.relayService.deleteRelay(relay.url);
  // }

  async deleteRelays() {
    await this.relayService.deleteRelays([]);
  }

  async clearProfileCache() {
    // await this.profileService.wipeNonFollow();
    this.wipedNonFollow = true;
  }

  // async onRelayChanged(relay: NostrRelay) {
  //   if (relay.metadata.enabled && relay.metadata.read) {
  //     await relay.connect();
  //   } else if (!relay.metadata.read) {
  //     await relay.close();
  //   } else {
  //     await relay.close();
  //   }

  //   await this.relayService.putRelayMetadata(relay.metadata);
  // }

  async clearDatabase() {
    await this.db.delete();
    this.wiped = true;
    // location.reload();
  }

  async clearNotesCache() {
    // await this.feedService.wipe();
    this.wipedNotes = true;
  }

  async getDefaultRelays() {
    // Append the default relays.
    await this.relayService.appendRelays(this.relayService.defaultRelays);
  }

  // private getPublicPublicKeys() {
  //   console.log(this.profileService.following);
  //   const items: string[] = [];

  //   for (let i = 0; i < this.circleService.circles.length; i++) {
  //     const circle = this.circleService.circles[i];

  //     if (circle.public) {
  //       const profiles = this.getFollowingInCircle(circle.id);
  //       const pubkeys = profiles.map((p) => p.pubkey);
  //       items.push(...pubkeys);
  //     }
  //   }

  //   return items;
  // }

  async getRelays() {
    const gt = globalThis as any;
    const relays = await gt.nostr.getRelays();

    // Append the default relays.
    await this.relayService.appendRelays(relays);
  }

  ngOnInit() {
    this.appState.updateTitle('Settings');
    this.appState.showBackButton = true;
    this.appState.actions = [
      {
        icon: 'add_circle',
        tooltip: 'Add Relay',
        click: () => {
          this.addRelay();
        },
      },
    ];
  }

  registerHandler(protocol: string, parameter: string) {
    // navigator.registerProtocolHandler(protocol, `./index.html?${parameter}=%s`);
    navigator.registerProtocolHandler(protocol, `/?${parameter}=%s`);
  }

  addRelay(): void {
    const dialogRef = this.dialog.open(AddRelayDialog, {
      data: { read: true, write: true },
      maxWidth: '100vw',
      panelClass: 'full-width-dialog',
    });

    dialogRef.afterClosed().subscribe(async (result: AddRelayDialogData) => {
      if (!result) {
        return;
      }

      // Append the Web Socket prefix if missing.
      if (result.url.indexOf('://') === -1) {
        result.url = 'wss://' + result.url;
      }

      await this.relayService.appendRelay(result.url, result.read, result.write);
    });
  }
}
