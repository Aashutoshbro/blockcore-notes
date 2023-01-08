import { ChangeDetectorRef, Component, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { ApplicationState } from '../services/applicationstate.service';
import { Utilities } from '../services/utilities.service';
import { relayInit, Relay } from 'nostr-tools';
import * as moment from 'moment';
import { DataValidation } from '../services/data-validation.service';
import { Circle, NostrEvent, NostrEventDocument, NostrProfile, NostrProfileDocument, ProfileStatus } from '../services/interfaces';
import { ProfileService } from '../services/profile.service';
import { SettingsService } from '../services/settings.service';
import { OptionsService } from '../services/options.service';
import { NavigationService } from '../services/navigation.service';
import { CircleService } from '../services/circle.service';
import { MatTabChangeEvent } from '@angular/material/tabs';
import { map, Observable, of, Subscription, tap } from 'rxjs';
import { DataService } from '../services/data.service';
import { NotesService } from '../services/notes.service';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css'],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserComponent {
  pubkey?: string | null;
  npub!: string;
  profile?: NostrProfileDocument;
  about?: string;
  imagePath = '/assets/profile.png';
  profileName = '';
  circle?: Circle;
  initialLoad = true;

  // userEvents$!: any;
  // replyEvents$!: any;

  userEvents$ = of(this.notesService.currentViewNotes).pipe(
    map((data) => {
      debugger;
      return data.sort((a, b) => {
        debugger;
        return a.created_at > b.created_at ? 1 : -1;
      });
    })
  );
  //.pipe(map((objs) => objs.map((c) => c.created_at).sort((a, b) => (a > b ? 1 : -1)))); //.pipe(map((bands) => [...bands].sort((a, b) => (a.created_at > b.created_at ? 1 : -1))));
  // this.titles$ = item.pipe(map(objs => objs.map(c => c.title).sort((a, b) => a.localCompare(b))))
  // tap((results) => {
  //   return results.sort((x, y) => (x.created_at < y.created_at ? -1 : 1)); // https://stackoverflow.com/a/50276301
  // })
  // .pipe(
  //   map((data) => {
  //     debugger;
  //     if (!this.pubkey) {
  //       return;
  //     }
  //     return data.filter((n) => n.pubkey == this.pubkey);
  //   })
  // );

  replyEvents$ = of(this.notesService.currentViewNotes).pipe(
    map((data) => {
      // debugger;
      if (!this.pubkey) {
        return;
      }

      return data.filter((n) => n.pubkey == this.pubkey);
    })
  );

  subscriptions: Subscription[] = [];

  profileSubscription?: Subscription;

  feedSubscription?: Subscription;

  constructor(
    public navigation: NavigationService,
    public appState: ApplicationState,
    private activatedRoute: ActivatedRoute,
    private cd: ChangeDetectorRef,
    public options: OptionsService,
    public profiles: ProfileService,
    private dataService: DataService,
    private validator: DataValidation,
    private circleService: CircleService,
    private utilities: Utilities,
    public notesService: NotesService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  async follow() {
    this.profile!.status = ProfileStatus.Follow;
    await this.profiles.follow(this.pubkey!);
    // this.feedService.downloadRecent([this.pubkey!]);
  }

  tabIndex?: number;

  onTabChanged(event: MatTabChangeEvent) {
    this.router.navigate([], { queryParams: { t: event.index }, replaceUrl: true });
  }

  ngOnInit() {
    // setInterval(() => {
    //   console.log('Closed:', this.feedSubscription?.closed);
    // }, 50);

    this.appState.showBackButton = true;
    this.appState.actions = [];

    this.subscriptions.push(
      this.activatedRoute.queryParams.subscribe(async (params) => {
        const tabIndex = params['t'];
        this.tabIndex = tabIndex;
      })
    );

    this.subscriptions.push(
      this.activatedRoute.paramMap.subscribe(async (params) => {
        const pubkey: any = params.get('id');

        // Whenever the user changes, unsubsribe the profile observable (which normally should be completed, but for safety).
        if (this.profileSubscription) {
          this.profileSubscription.unsubscribe();
        }

        if (this.feedSubscription) {
          this.feedSubscription.unsubscribe();
        }

        if (!pubkey) {
          return;
        }

        this.pubkey = pubkey;

        this.profileSubscription = this.profiles.getProfile(pubkey).subscribe(async (profile) => {
          this.profile = profile;

          if (!this.profile) {
            this.profile = this.profiles.emptyProfile(pubkey);
            this.circle = undefined;
          }

          this.npub = this.utilities.getNostrIdentifier(pubkey);

          if (!this.profile.name) {
            this.profile.name = this.npub;
          }

          this.profileName = this.profile.name;

          if (this.profileName)
            if (!this.profile.display_name) {
              this.profile.display_name = this.profileName;
            }

          this.imagePath = this.profile.picture || '/assets/profile.png';

          this.circle = await this.circleService.get(this.profile.circle);

          // If the user has name in their profile, show that and not pubkey.
          this.appState.title = `@${this.profile.name}`;
        });

        this.feedSubscription = this.dataService.downloadNewestEventsByQuery([{ kinds: [1], authors: [this.pubkey], limit: 100 }]).subscribe((event) => {
          console.log('EVENT:', event);

          const existingIndex = this.notesService.currentViewNotes.findIndex((e) => e.id == event.id);

          if (existingIndex !== -1) {
            return;
          }

          this.notesService.currentViewNotes.unshift(event);
          this.notesService.currentViewNotes.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

          // this.ngZone.run(() => {
          //   this.notesService.currentViewNotes.push(event);
          // });

          // console.log('LENGTH:', this.notesService.currentViewNotes.length);
        });
      })
    );

    // if (this.pubkey) {
    // console.log('PIPING EVENTS...');
    // this.userEvents$ =
    // }
  }

  optionsUpdated() {
    // this.allComplete = this.task.subtasks != null && this.task.subtasks.every(t => t.completed);
    // Parse existing content.
    // this.events = this.validator.filterEvents(this.events);
  }

  activeOptions() {
    let options = '';

    if (this.options.options.hideSpam) {
      options += ' Spam: Filtered';
    } else {
      options += ' Spam: Allowed';
    }

    if (this.options.options.hideInvoice) {
      options += ' Invoices: Hidden';
    } else {
      options += ' Invoices: Displayed';
    }

    return options;
  }

  public trackByFn(index: number, item: NostrEvent) {
    return item.id;
  }

  ngOnDestroy() {
    this.utilities.unsubscribe(this.subscriptions);

    if (this.profileSubscription) {
      this.profileSubscription.unsubscribe();
    }

    if (this.feedSubscription) {
      this.feedSubscription.unsubscribe();
    }
  }
}
