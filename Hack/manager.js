/** @param {NS} ns */
import { get_all_servers } from "utility.js"
import { install_hacks } from "utility.js"
export async function main(ns: NS) {
	//Note: Functions mutate variables
	ns.disableLog("ALL")

	ns.ui.openTail()

	while (true) {
		//opens ports gain access and nuke
		install_hacks(ns)

		//target server
    const script_ram = {
      hack_ram: ns.getScriptRam("hack.js", "home")
		  grow_ram: ns.getScriptRam("grow.js", "home")
		  weaken_ram: ns.getScriptRam("weaken.js", "home")
    }

    const CONFIG = {
      HOME_RAM_RESERVE: 10,
      WEAKEN_BUFFER_MULTIPLIER: 1.05,
      TARGET_HACK_PERCENT: 0.01,
      MONEY_RESTART_THRESHOLD: 0.75,
      QUALITY_CALC_LEVEL_THRESHOLD: 300
    }
    
    const servers = {
      all: get_all_servers(ns)
		  available: []
    }
    
    const state = {
      is_playing: true
      longest_time: -1
      
      threads: {
        hack: { required: 0, current: 0},
        grow: { required: 0, current: 0},
        weaken: { required: 0, current: 0},

      }
      target: {
        server: "",
        quality: 0
      }
    }

    servers.available = create_available_servers(servers.all)
		
		for (const server of servers.available) {
			check_server_quality(server)
		}

    prep()
    main_hack()
    
    async function prep(){
      ns.print("\nChecking Prep for " + state.target.server)
      print_server_values(state.target.server)

      //set server to max money and weaken to min_sec
      while (is_server_prepped(state.target.server) === false) {
        print_server_values(state.target.server)

        prep_hack(state.target.server)

        ns.print("PrepHacking: " + state.target.server)
        print_threads()

        for (const target of servers.available) {
          hack(target)
        }

        //current, required ie total_threads.current
        const total_threads = calculate_total_threads(state.threads)
        
        ns.print("Threads: " + total_threads.current + "/" + total_threads.required)
        if (total_threads.required == total_threads.current) {
          ns.print("Successful Prep")
        } else {
          ns.print("Prepping more. Missing " + (total_threads.required - total_threads.current) + " threads.")
        }

        //wait to finish
        ns.print("Estimated time: " + ns.tFormat(state.longest_time))
        await ns.sleep(state.longest_time + 1000)
        reset_loop_variables()
      }
    }

    async function main_hack(){
      let current_loop = 0
      reset_loop_variables()
      ns.print("\nStarting Hack")
      //@ignore-infinite
      while (true) {
        //main loop
        ns.print("\nCurrent_loop: " + current_loop + " for " + state.target.server)
        calc_threads(state.target.server)

        print_server_values(state.target.server)
        print_threads(state.threads)

        //if required total ram is smaller than the space remaining don't do it
        ns.print("Estimated ram usage: " + calculate_ram_usage())
        //subtract the home cost 10 so i can test
        ns.print("Available Ram: " + (get_total_ram() - get_used_ram() - 10))
        if (calculate_ram_usage() < get_total_ram() - get_used_ram() - 10 && check_available_small_ram()) {
          ns.print("Hacking...")
          //TODO:not quite there yet
          hack(servers.available)
        } else {
          ns.print("Aborting...")
          ns.print("Duration: " + ns.tFormat(state.longest_time))
        }

        const total_threads = calculate_total_threads(state.threads)

        if (total_threads.required === total_threads.current) {
          ns.print("Successful hack")
        } else {
          ns.print("Failed hack")
          ns.print("Duration: " + ns.tFormat(state.longest_time))
          await ns.sleep(state.longest_time + 1000)
          ns.toast("Starting next Batch Cycle")
        }

        const reset = reset_loop_variables()
        state.longest_time = reset.longest_time
        state.threads = reset.threads

        current_loop += 1

        if ((ns.getServerMoneyAvailable(state.target.server) / ns.getServerMaxMoney(state.target.server)) < CONFIG.MONEY_RESTART_THRESHOLD) {
          restart()
        }

        if (is_playing == false) {
          ns.tprint("Restarting... \n")
          ns.toast("Restarting... \n")
          break
        }
      }
    }

    function is_server_prepped(passed_server){
      const max_money = ns.getServerMaxMoney(passed_server)
      const money = ns.getServerMoneyAvailable(passed_server)
      const min_sec = ns.getServerMinSecurityLevel(passed_server)
      const sec_level = ns.getServerSecurityLevel(passed_server)

      return max_money === money and min_sec === sec_level
    }

    function print_server_values(passed_server){
			ns.print("Money: " + ns.getServerMoneyAvailable(passed_server) + " / " + ns.getServerMaxMoney(passed_server))
			ns.print("Security: " + ns.getServerSecurityLevel(passed_server) + " / " + ns.getServerMinSecurityLevel(passed_server))
    }

		function print_threads(threads) {
			ns.print("Amount of threads: " + (state.threads.hack.required + state.threads.grow.required + state.threads.weaken.required))
			ns.print("Amount of Hack Thread: " + state.threads.hack.required)
			ns.print("Amount of Grow Thread: " + state.threads.grow.required)
			ns.print("Amount of Weaken Thread: " + state.threads.weaken.required)
		}

		//set a boolean to break out of all loops
		function restart() {
			is_playing = false
		}

		function check_available_small_ram() {
			for (const target of servers.available) {
				const free_ram = ns.getServerMaxRam(target) - ns.getServerUsedRam(target)
				if (free_ram >= hack_ram || free_ram >= grow_ram || free_ram >= weaken_ram) {
					return true
				}
			}
			return false
		}

    function calculate_total_threads(threads){
      return{
        required: threads.hack.required + threads.grow.required  + threads.weaken.required
        current:  threads.hack.current  + threads.grow.current   + threads.weaken.current,
      }
    }

		function calculate_ram_usage() {
			const hack_ram_usage = state.threads.hack.required * hack_ram
			const grow_ram_usage = state.threads.grow.required * grow_ram
			const weaken_ram_usage = state.threads.weaken.required * weaken_ram
			return hack_ram_usage + grow_ram_usage + weaken_ram_usage
		}

		function get_total_ram() {
			let max_ram = 0
			let used_ram = 0
			for (const server of servers.available) {
				max_ram += ns.getServerMaxRam(server)
			}
			return max_ram
		}

		function get_used_ram() {
			let used_ram = 0
			for (const server of servers.available) {
				used_ram += ns.getServerUsedRam(server)
			}
			return used_ram
		}

		function reset_loop_variables() {
      return{
        longest_time: -1,
        threads: {
          hack{ required: 0, current: 0},
          grow{ required: 0, current: 0},
          weaken{ required: 0, current: 0},
        }
      }
		}

    function create_available_servers(passed_servers){
      let hackable_servers
      for(const server of passed_servers){
        if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(server) && ns.hasRootAccess(server)) {
          hackable_servers.push(server)
        }
      }
      return hackable_servers
    }

    //TODO: return the state rather than mutate
		function check_server_quality(passed_target: string) {
      //check if its at least half my level or if its level 0...
      if (ns.getHackingLevel() / 2 >= ns.getServerRequiredHackingLevel(passed_target) || ns.getServerRequiredHackingLevel(passed_target) == 0) {
        //calculate based on how good it gets
        let growth_amount = ns.getServerGrowth(passed_target)
        let max_money = ns.getServerMaxMoney(passed_target)
        let min_security = ns.getServerMinSecurityLevel(passed_target)

        let server_quality
        if (ns.getHackingLevel() < CONFIG.QUALITY_CALC_LEVEL_THRESHOLD){
          server_quality = (growth_amount * max_money) / min_security
        }else{
          server_quality = max_money / min_security
        }
        //ns.tprint(passed_target + " quality: " + server_quality.toLocaleString("en-US"))

        //doesn't account for equal quality
        if (highest_quality_in_server < server_quality) {
          highest_quality_in_server = server_quality
          state.target.server = passed_target
        }
      }
		}
    
    //TODO: return the state rather than mutate
		function prep_hack(passed_target: string) {
			let grow_time = ns.getGrowTime(passed_target)
			let hack_time = ns.getHackTime(passed_target)
			let weaken_time = ns.getWeakenTime(passed_target)
			let max_time = Math.max(grow_time, hack_time, weaken_time)

			//comes from outside of the function
			state.longest_time = max_time

			//get amount of threads needed //its okay I didn't pass something in
			let grow_threads = calc_grow_threads(passed_target)
			let weaken_threads = calc_weaken_threads(passed_target)
			weaken_threads += Math.ceil(ns.growthAnalyzeSecurity(grow_threads, passed_target)/ns.weakenAnalyze(1))
			

			//comes from outside of the function
			state.threads.grow.required = grow_threads
			state.threads.weaken.required = Math.ceil(weaken_threads * CONFIG.WEAKEN_BUFFER_MULTIPLIER)
		}
  
    //TODO: return the state rather than mutate
		function calc_threads(passed_target: string) {
			//check for the longest time
			let grow_time = ns.getGrowTime(passed_target)
			let hack_time = ns.getHackTime(passed_target)
			let weaken_time = ns.getWeakenTime(passed_target)
			let max_time = Math.max(grow_time, hack_time, weaken_time)

			//comes from outside of the function
			state.longest_time = max_time

			//calculate threads needed
			let hack_threads = calc_hack_threads(passed_target, target_percentage)
			let grow_threads = calc_grow_threads(passed_target, target_percentage)
			let weaken_threads = Math.ceil((ns.hackAnalyzeSecurity(hack_threads, passed_target)) + (ns.growthAnalyzeSecurity(grow_threads, passed_target, 1)) / ns.weakenAnalyze(1))

			//comes from outside of the function
			state.threads.hack.required = hack_threads
			state.threads.grow.required = grow_threads
			state.threads.weaken.required = Math.ceil(weaken_threads * CONFIG.WEAKEN_BUFFER_MULTIPLIER)
		}
    
    //TODO: finish cleaning up and return a proper object
		function hack(passed_servers) {
      for(server in servers){
        const hack_check = (state.threads.hack.current < state.threads.hack.required)
        const grow_check = (state.threads.grow.current < state.threads.grow.required)
        const weaken_check = (state.threads.weaken.current < state.threads.weaken.required)

        let available_ram = ns.getServerMaxRam(passed_target) - ns.getServerUsedRam(passed_target)
        //I need the space to test things
        if (passed_target == "home") {
          available_ram = ns.getServerMaxRam(passed_target) - (ns.getServerUsedRam(passed_target) + CONFIG.HOME_RAM_RESERVE)
        }
        let has_ram = check_ram(available_ram)


        if (grow_check && has_ram) {
          state.threads.grow.current = check_helper(state.threads.grow.required, state.threads.grow.current, "grow.js", ns.getGrowTime(state.target.server))
        }
        if (hack_check && has_ram) {
          state.threads.hack.current = check_helper(state.threads.hack.required, state.threads.hack.current, "hack.js", ns.getHackTime(state.target.server))
        }
        if (weaken_check && has_ram) {
          state.threads.weaken.current = check_helper(state.threads.weaken.required, state.threads.weaken.current, "weaken.js", ns.getWeakenTime(state.target.server))
        }

        //check if you need anymore hacks
        if (hack_check && grow_check && weaken_check)
          return true
        else
          return false
      }
    }

			function check_helper(required: number, current: number, script: string, duration: number) {
				const script_ram = ns.getScriptRam(script, "home")

				const possible_thread_amount = Math.floor(available_ram / script_ram)
				const needed_threads = required - current

				const threads_to_use = Math.min(possible_thread_amount, needed_threads)
				if (threads_to_use > 0) {
					const has_succeeded = ns.exec(script, passed_target, threads_to_use, ...[state.target.server, state.longest_time - duration])
					if (has_succeeded != 0) {
						available_ram -= threads_to_use * script_ram
						current += threads_to_use
						has_ram = check_ram(available_ram)
					}
				}

				return current
			}

			function check_ram(passed_ram: number) {
				if (passed_ram > hack_ram || passed_ram > grow_ram || passed_ram > weaken_ram) {
					return true
				} else return false
			}
		}

		function calc_hack_threads(passed_target: string, passed_pecentage: number) {
			const money = Math.max(ns.getServerMoneyAvailable(passed_target), 1)

			return Math.ceil(ns.hackAnalyzeThreads(passed_target, money * passed_pecentage))
		}

		function calc_grow_threads(passed_target: string, passed_pecentage: number = 0) {
			const money = Math.max(ns.getServerMoneyAvailable(passed_target), 1)
			const max_money = ns.getServerMaxMoney(passed_target)

			const target_percent = passed_pecentage ? 1 / (1 - passed_pecentage) : (max_money / money)

			return Math.ceil(ns.growthAnalyze(passed_target, target_percent))
		}

		function calc_weaken_threads(passed_target: string) {
			const min_sec = ns.getServerMinSecurityLevel(passed_target)
			const sec = ns.getServerSecurityLevel(passed_target)
			const weaken_threads = Math.ceil((sec - min_sec) / ns.weakenAnalyze(1, 1))

			return weaken_threads
		}
	}
}

